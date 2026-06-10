import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, sendActionEmail, sendActionSms } from "@/lib/notify";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEMPLATES = new Set(["SOAP", "Progress", "Discharge", "Consult"]);

interface NoteRow {
  id: string;
  patientId: string;
  clinicianId: string;
  template: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  body: string | null;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  finalizedAt: Date | null;
  patientFirstName: string | null;
  patientLastName: string | null;
}

async function guardClinician() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Clinician")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, notes: [] }) } as const;
  return { claims } as const;
}

function shape(r: NoteRow) {
  return {
    id: r.id,
    patientId: r.patientId,
    clinicianId: r.clinicianId,
    template: r.template,
    subjective: r.subjective,
    objective: r.objective,
    assessment: r.assessment,
    plan: r.plan,
    body: r.body,
    status: r.status,
    version: Number(r.version),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString() : null,
    patientName:
      [r.patientFirstName, r.patientLastName].filter(Boolean).join(" ").trim() || null,
  };
}

/**
 * GET — list clinical notes authored by the signed-in clinician. Optional
 * `?patientId=` scopes to one patient (used by the patient chart Records tab).
 */
export async function GET(req: Request) {
  const g = await guardClinician();
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");
  if (patientId && !UUID_RE.test(patientId))
    return NextResponse.json({ ok: false, error: "Invalid patientId." }, { status: 400 });

  const rows = patientId
    ? await prisma.$queryRaw<NoteRow[]>`
        SELECT m.id, m."patientId", m."clinicianId", m.template, m.subjective, m.objective,
               m.assessment, m.plan, m.body, m.status, m.version,
               m."createdAt", m."updatedAt", m."finalizedAt",
               u."firstName" AS "patientFirstName",
               u."lastName"  AS "patientLastName"
        FROM medical_records m
        LEFT JOIN users u ON u.id = m."patientId"
        WHERE m."clinicianId" = ${g.claims.uid}::uuid
          AND m."patientId" = ${patientId}::uuid
          AND m."deletedAt" IS NULL
        ORDER BY m."updatedAt" DESC
      `
    : await prisma.$queryRaw<NoteRow[]>`
        SELECT m.id, m."patientId", m."clinicianId", m.template, m.subjective, m.objective,
               m.assessment, m.plan, m.body, m.status, m.version,
               m."createdAt", m."updatedAt", m."finalizedAt",
               u."firstName" AS "patientFirstName",
               u."lastName"  AS "patientLastName"
        FROM medical_records m
        LEFT JOIN users u ON u.id = m."patientId"
        WHERE m."clinicianId" = ${g.claims.uid}::uuid
          AND m."deletedAt" IS NULL
        ORDER BY m."updatedAt" DESC
      `;
  return NextResponse.json({ ok: true, notes: rows.map(shape) });
}

interface PostBody {
  patientId?: string;
  template?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  body?: string;
  status?: "draft" | "finalized";
}

/**
 * POST — create a new note (draft by default; pass `status:"finalized"` to
 * lock immediately, which the New note → Save & finalize button uses).
 */
export async function POST(req: Request) {
  const g = await guardClinician();
  if ("error" in g) return g.error;
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const patientId = body.patientId?.trim() ?? "";
  if (!UUID_RE.test(patientId))
    return NextResponse.json({ ok: false, error: "Invalid patientId." }, { status: 400 });
  const template = body.template?.trim() ?? "SOAP";
  if (!TEMPLATES.has(template))
    return NextResponse.json(
      { ok: false, error: `Template must be one of: ${[...TEMPLATES].join(", ")}` },
      { status: 400 },
    );

  // Validate users + grab clinician.organizationId.
  const clinicianRows = await prisma.$queryRaw<
    { id: string; organizationId: string | null; roleKind: string; firstName: string | null; lastName: string | null; orgName: string | null }[]
  >`
    SELECT u.id, u."organizationId", u."roleKind"::text AS "roleKind",
           u."firstName", u."lastName", o.name AS "orgName"
    FROM users u LEFT JOIN organizations o ON o.id = u."organizationId"
    WHERE u.id = ${g.claims.uid}::uuid AND u."deletedAt" IS NULL LIMIT 1
  `;
  const clinician = clinicianRows[0];
  if (!clinician || clinician.roleKind !== "clinician")
    return NextResponse.json({ ok: false, error: "Clinician not found." }, { status: 404 });
  if (!clinician.organizationId)
    return NextResponse.json({ ok: false, error: "Clinician has no tenant." }, { status: 400 });

  const patientRows = await prisma.$queryRaw<
    { id: string; roleKind: string; email: string | null; firstName: string | null; phone: string | null }[]
  >`
    SELECT id, "roleKind"::text AS "roleKind", email, "firstName", phone
    FROM users WHERE id = ${patientId}::uuid AND "deletedAt" IS NULL LIMIT 1
  `;
  if (!patientRows[0] || patientRows[0].roleKind !== "patient")
    return NextResponse.json({ ok: false, error: "Patient not found." }, { status: 404 });

  const finalize = body.status === "finalized";
  const subjective = body.subjective?.trim() || null;
  const objective = body.objective?.trim() || null;
  const assessment = body.assessment?.trim() || null;
  const plan = body.plan?.trim() || null;
  const noteBody = body.body?.trim() || null;

  if (finalize) {
    // Require something written before finalize.
    if (!subjective && !objective && !assessment && !plan && !noteBody) {
      return NextResponse.json(
        { ok: false, error: "Add content before finalizing the note." },
        { status: 400 },
      );
    }
  }

  const status = finalize ? "finalized" : "draft";
  const inserted = await prisma.$queryRaw<NoteRow[]>`
    INSERT INTO medical_records
      (id, "patientId", "clinicianId", "organizationId", template,
       subjective, objective, assessment, plan, body, status, version,
       "createdAt", "updatedAt", "finalizedAt")
    VALUES
      (gen_random_uuid(), ${patientId}::uuid, ${g.claims.uid}::uuid,
       ${clinician.organizationId}::uuid, ${template},
       ${subjective}, ${objective}, ${assessment}, ${plan}, ${noteBody},
       ${status}, 1, NOW(), NOW(), ${finalize ? new Date() : null})
    RETURNING id, "patientId", "clinicianId", template, subjective, objective,
              assessment, plan, body, status, version,
              "createdAt", "updatedAt", "finalizedAt",
              NULL::text AS "patientFirstName",
              NULL::text AS "patientLastName"
  `;
  // Re-fetch with the patient join for a fully-shaped response.
  const withPatient = await prisma.$queryRaw<NoteRow[]>`
    SELECT m.id, m."patientId", m."clinicianId", m.template, m.subjective, m.objective,
           m.assessment, m.plan, m.body, m.status, m.version,
           m."createdAt", m."updatedAt", m."finalizedAt",
           u."firstName" AS "patientFirstName",
           u."lastName"  AS "patientLastName"
    FROM medical_records m
    LEFT JOIN users u ON u.id = m."patientId"
    WHERE m.id = ${inserted[0].id}::uuid
  `;

  // Email the patient that a new record is available — only when FINALIZED
  // (drafts aren't visible to the patient). Gated by the patient's Records
  // EMAIL preference (categoryKey "records").
  if (finalize && patientRows[0].email) {
    const clinicianName = `Dr. ${[clinician.firstName, clinician.lastName].filter(Boolean).join(" ")}`.trim();
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    await sendActionEmail({
      orgId: clinician.organizationId,
      to: patientRows[0].email,
      categoryKey: "records",
      slug: "new-record-available",
      vars: {
        "patient.first_name": patientRows[0].firstName?.trim() || "there",
        "clinician.name": clinicianName,
        "record.category": `${template} note`,
        "record.date": today,
        "organization.name": clinician.orgName ?? "HealthSecure",
        action_url: `${appBaseUrl()}/patient/records`,
      },
      fallbackSubject: `A new ${template} note is available in your portal`,
      fallbackText:
        `Hi ${patientRows[0].firstName?.trim() || "there"},\n\n` +
        `${clinicianName} finalized a new ${template} note on ${today}.\n\n` +
        `Open your portal to view it: ${appBaseUrl()}/patient/records\n\n— ${clinician.orgName ?? "HealthSecure"}`,
    });
    await sendActionSms({
      toPhone: patientRows[0].phone,
      recipientEmail: patientRows[0].email,
      categoryKey: "records",
      text: `${clinician.orgName ?? "HealthSecure"}: a new ${template} note is available in your portal.`,
    });
  }

  return NextResponse.json({ ok: true, note: shape(withPatient[0]) }, { status: 201 });
}
