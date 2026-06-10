import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, scopeLabels, sendActionEmail, sendActionSms } from "@/lib/notify";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KNOWN_SCOPES = new Set([
  "lab", "prescriptions", "notes", "imaging", "mental_health",
  "insurance", "id_proof", "other",
]);

async function guardClinician() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Clinician")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 }) } as const;
  // Demo-user session — short-circuit with an empty list so the chart's 15s
  // poll doesn't 500 on a non-UUID id in the `::uuid` cast below.
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, requests: [] }) } as const;
  return { claims } as const;
}

interface PostBody {
  patientId?: string;
  scopes?: string[];
  durationHours?: number;
  reason?: string;
}

interface RowOut {
  id: string;
  patientId: string;
  scopes: unknown;
  durationHours: number;
  reason: string;
  status: string;
  requestedAt: Date;
  decidedAt: Date | null;
  expiresAt: Date | null;
}

/**
 * GET — list this clinician's consent requests, optionally filtered by
 * patientId. Used by the clinician's patient-chart page to poll for the
 * patient's decision so the pending banner flips to the green approved
 * banner without a manual refresh.
 */
export async function GET(req: Request) {
  const g = await guardClinician();
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");

  const rows = patientId && UUID_RE.test(patientId)
    ? await prisma.$queryRaw<RowOut[]>`
        SELECT id, "patientId", scopes, "durationHours", reason, status,
               "requestedAt", "decidedAt", "expiresAt"
        FROM consent_requests
        WHERE "clinicianId" = ${g.claims.uid}::uuid
          AND "patientId"   = ${patientId}::uuid
        ORDER BY "requestedAt" DESC
        LIMIT 50
      `
    : await prisma.$queryRaw<RowOut[]>`
        SELECT id, "patientId", scopes, "durationHours", reason, status,
               "requestedAt", "decidedAt", "expiresAt"
        FROM consent_requests
        WHERE "clinicianId" = ${g.claims.uid}::uuid
        ORDER BY "requestedAt" DESC
        LIMIT 50
      `;

  return NextResponse.json({
    ok: true,
    requests: rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      scopes: Array.isArray(r.scopes) ? r.scopes : [],
      durationHours: Number(r.durationHours),
      reason: r.reason,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    })),
  });
}

/**
 * Clinician submits a sensitive-access request for a specific patient. The
 * patient sees the request on `/patient/consents` as a "Pending consent
 * request" banner and approves or declines it from there.
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

  const scopes = Array.isArray(body.scopes)
    ? body.scopes.filter((s): s is string => typeof s === "string" && KNOWN_SCOPES.has(s))
    : [];
  if (scopes.length === 0)
    return NextResponse.json({ ok: false, error: "Pick at least one scope." }, { status: 400 });

  const durationHours = Number.isFinite(body.durationHours) ? Number(body.durationHours) : 24;
  if (durationHours < 1 || durationHours > 168)
    return NextResponse.json({ ok: false, error: "Duration must be 1–168 hours." }, { status: 400 });

  const reason = body.reason?.trim() ?? "";
  if (reason.length < 10)
    return NextResponse.json(
      { ok: false, error: "Provide a clinical justification (10+ chars)." },
      { status: 400 },
    );

  // Validate clinician has an org + patient is real.
  const clinicianRows = await prisma.$queryRaw<
    { organizationId: string | null; roleKind: string; firstName: string | null; lastName: string | null; orgName: string | null }[]
  >`
    SELECT u."organizationId", u."roleKind"::text AS "roleKind",
           u."firstName", u."lastName", o.name AS "orgName"
    FROM users u
    LEFT JOIN organizations o ON o.id = u."organizationId"
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

  // Reject a duplicate pending request for the same (clinician, patient)
  // pair — keep the latest one only.
  const dup = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM consent_requests
    WHERE "patientId" = ${patientId}::uuid
      AND "clinicianId" = ${g.claims.uid}::uuid
      AND status = 'pending'
    LIMIT 1
  `;
  if (dup[0]) {
    return NextResponse.json(
      { ok: false, error: "A pending request already exists for this patient." },
      { status: 409 },
    );
  }

  const inserted = await prisma.$queryRaw<{ id: string; requestedAt: Date }[]>`
    INSERT INTO consent_requests
      (id, "patientId", "clinicianId", "organizationId", scopes,
       "durationHours", reason, status, "requestedAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${patientId}::uuid, ${g.claims.uid}::uuid,
       ${clinician.organizationId}::uuid, ${JSON.stringify(scopes)}::jsonb,
       ${durationHours}, ${reason}, 'pending', NOW(), NOW(), NOW())
    RETURNING id, "requestedAt"
  `;

  // Email the patient that a clinician is requesting consent (best-effort).
  const clinicianName =
    `Dr. ${[clinician.firstName, clinician.lastName].filter(Boolean).join(" ")}`.trim();
  await sendActionEmail({
    orgId: clinician.organizationId,
    to: patientRows[0].email,
    categoryKey: "consents",
    slug: "consent-request",
    vars: {
      "patient.first_name": patientRows[0].firstName?.trim() || "there",
      "clinician.name": clinicianName,
      "consent.scope": scopeLabels(scopes),
      "consent.policy_version": "v2.4",
      "organization.name": clinician.orgName ?? "HealthSecure",
      action_url: `${appBaseUrl()}/patient/consents`,
    },
    fallbackSubject: `${clinicianName} is requesting access to your ${scopeLabels(scopes)}`,
    fallbackText:
      `Hi ${patientRows[0].firstName?.trim() || "there"},\n\n` +
      `${clinicianName} has requested access to your ${scopeLabels(scopes)} records.\n\n` +
      `Reason: ${reason}\n\n` +
      `Review and approve or decline this request in your portal: ${appBaseUrl()}/patient/consents\n\n` +
      `You can revoke any consent at any time.\n\n— ${clinician.orgName ?? "HealthSecure"}`,
  });
  await sendActionSms({
    toPhone: patientRows[0].phone,
    recipientEmail: patientRows[0].email,
    categoryKey: "consents",
    text: `${clinician.orgName ?? "HealthSecure"}: ${clinicianName} is requesting access to your ${scopeLabels(scopes)}. Review it in your portal.`,
  });

  return NextResponse.json(
    {
      ok: true,
      request: {
        id: inserted[0].id,
        patientId,
        scopes,
        durationHours,
        reason,
        status: "pending",
        requestedAt: inserted[0].requestedAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
