import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, sendActionEmail, sendActionSms } from "@/lib/notify";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PrescriptionRow {
  id: string;
  patientId: string;
  clinicianId: string;
  drugName: string;
  strength: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  refills: number;
  patientInstructions: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  finalizedAt: Date | null;
  deletedAt: Date | null;
}

async function guardClinician() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Clinician")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 }) } as const;
  return { claims } as const;
}

function shape(r: PrescriptionRow) {
  return {
    id: r.id,
    patientId: r.patientId,
    clinicianId: r.clinicianId,
    drugName: r.drugName,
    strength: r.strength,
    route: r.route,
    frequency: r.frequency,
    duration: r.duration,
    refills: Number(r.refills),
    patientInstructions: r.patientInstructions,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString() : null,
  };
}

async function findOne(id: string): Promise<PrescriptionRow | null> {
  const rows = await prisma.$queryRaw<PrescriptionRow[]>`
    SELECT id, "patientId", "clinicianId", "drugName", strength, route, frequency,
           duration, refills, "patientInstructions", status,
           "createdAt", "updatedAt", "finalizedAt", "deletedAt"
    FROM prescriptions
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guardClinician();
  if ("error" in g) return g.error;
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid prescription id." }, { status: 400 });
  const r = await findOne(id);
  if (!r || r.deletedAt || r.clinicianId !== g.claims.uid)
    return NextResponse.json({ ok: false, error: "Prescription not found." }, { status: 404 });
  return NextResponse.json({ ok: true, prescription: shape(r) });
}

interface PatchBody {
  drugName?: string;
  strength?: string | null;
  route?: string | null;
  frequency?: string | null;
  duration?: string | null;
  refills?: number;
  patientInstructions?: string | null;
  status?: "draft" | "finalized";
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guardClinician();
  if ("error" in g) return g.error;
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid prescription id." }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const existing = await findOne(id);
  if (!existing || existing.deletedAt || existing.clinicianId !== g.claims.uid)
    return NextResponse.json({ ok: false, error: "Prescription not found." }, { status: 404 });
  if (existing.status === "finalized")
    return NextResponse.json({ ok: false, error: "Finalized prescriptions cannot be edited." }, { status: 409 });

  // Build a column → value list to splice into a single UPDATE. We always
  // touch updatedAt; finalize additionally sets status + finalizedAt.
  const next = { ...existing };
  if (typeof body.drugName === "string") {
    const v = body.drugName.trim();
    if (!v) return NextResponse.json({ ok: false, error: "Drug name is required." }, { status: 400 });
    next.drugName = v;
  }
  if (body.strength !== undefined) next.strength = (body.strength ?? "").toString().trim() || null;
  if (body.route !== undefined) next.route = (body.route ?? "").toString().trim() || null;
  if (body.frequency !== undefined) next.frequency = (body.frequency ?? "").toString().trim() || null;
  if (body.duration !== undefined) next.duration = (body.duration ?? "").toString().trim() || null;
  if (body.refills !== undefined) {
    const n = Number(body.refills);
    if (!Number.isFinite(n) || n < 0 || n > 12)
      return NextResponse.json({ ok: false, error: "Refills must be 0–12." }, { status: 400 });
    next.refills = Math.floor(n);
  }
  if (body.patientInstructions !== undefined)
    next.patientInstructions = (body.patientInstructions ?? "").toString().trim() || null;

  const finalize = body.status === "finalized";
  if (finalize) {
    if (!next.drugName || !next.strength || !next.frequency || !next.duration) {
      return NextResponse.json(
        { ok: false, error: "Drug, strength, frequency, and duration are required to finalize." },
        { status: 400 },
      );
    }
  }

  // Single UPDATE statement using Prisma.sql for safe param binding.
  const updated = await prisma.$queryRaw<PrescriptionRow[]>`
    UPDATE prescriptions
       SET "drugName"            = ${next.drugName},
           strength              = ${next.strength},
           route                 = ${next.route},
           frequency             = ${next.frequency},
           duration              = ${next.duration},
           refills               = ${next.refills},
           "patientInstructions" = ${next.patientInstructions},
           status                = ${finalize ? "finalized" : next.status},
           "finalizedAt"         = ${finalize ? Prisma.sql`NOW()` : Prisma.sql`"finalizedAt"`},
           "updatedAt"           = NOW()
     WHERE id = ${id}::uuid
    RETURNING id, "patientId", "clinicianId", "drugName", strength, route, frequency,
              duration, refills, "patientInstructions", status,
              "createdAt", "updatedAt", "finalizedAt", "deletedAt"
  `;

  // On finalize, email the patient that a new prescription is available
  // (gated by their Records EMAIL preference). Drafts don't notify.
  if (finalize) {
    const ctx = await prisma.$queryRaw<{
      patientEmail: string | null;
      patientPhone: string | null;
      patientFirst: string | null;
      clinicianFirst: string | null;
      clinicianLast: string | null;
      orgId: string | null;
      orgName: string | null;
    }[]>`
      SELECT p.email AS "patientEmail", p.phone AS "patientPhone", p."firstName" AS "patientFirst",
             c."firstName" AS "clinicianFirst", c."lastName" AS "clinicianLast",
             c."organizationId"::text AS "orgId", o.name AS "orgName"
      FROM users p
      LEFT JOIN users c         ON c.id = ${g.claims.uid}::uuid
      LEFT JOIN organizations o ON o.id = c."organizationId"
      WHERE p.id = ${updated[0].patientId}::uuid LIMIT 1
    `;
    const cx = ctx[0];
    if (cx?.patientEmail && cx.orgId) {
      const clinicianName = `Dr. ${[cx.clinicianFirst, cx.clinicianLast].filter(Boolean).join(" ")}`.trim();
      const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      await sendActionEmail({
        orgId: cx.orgId,
        to: cx.patientEmail,
        categoryKey: "records",
        slug: "new-record-available",
        vars: {
          "patient.first_name": cx.patientFirst?.trim() || "there",
          "clinician.name": clinicianName,
          "record.category": "Prescription",
          "record.date": today,
          "organization.name": cx.orgName ?? "HealthSecure",
          action_url: `${appBaseUrl()}/patient/prescriptions`,
        },
        fallbackSubject: `A new prescription is available in your portal`,
        fallbackText:
          `Hi ${cx.patientFirst?.trim() || "there"},\n\n` +
          `${clinicianName} issued a new prescription (${updated[0].drugName}) on ${today}.\n\n` +
          `Open your portal to view it: ${appBaseUrl()}/patient/prescriptions\n\n— ${cx.orgName ?? "HealthSecure"}`,
      });
      await sendActionSms({
        toPhone: cx.patientPhone,
        recipientEmail: cx.patientEmail,
        categoryKey: "records",
        text: `${cx.orgName ?? "HealthSecure"}: a new prescription (${updated[0].drugName}) is available in your portal.`,
      });
    }
  }

  return NextResponse.json({ ok: true, prescription: shape(updated[0]) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guardClinician();
  if ("error" in g) return g.error;
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid prescription id." }, { status: 400 });
  const existing = await findOne(id);
  if (!existing || existing.deletedAt || existing.clinicianId !== g.claims.uid)
    return NextResponse.json({ ok: false, error: "Prescription not found." }, { status: 404 });
  if (existing.status === "finalized")
    return NextResponse.json({ ok: false, error: "Finalized prescriptions cannot be deleted." }, { status: 409 });
  await prisma.$executeRaw`
    UPDATE prescriptions SET "deletedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = ${id}::uuid
  `;
  return NextResponse.json({ ok: true });
}
