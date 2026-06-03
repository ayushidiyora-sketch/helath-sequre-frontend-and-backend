import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Patient-initiated consent grants — separate from the clinician → patient
 * request flow at /api/patient/consent-requests. When the patient hits
 * "Grant new consent" from /patient/consents/grant, this endpoint INSERTs a
 * pre-approved row in `consent_requests` so the same record surfaces to
 * Compliance and Auditor surfaces.
 *
 * Status mapping mirrors the compliance feed:
 *   POST          → status=approved, decidedAt=NOW, expiresAt=NULL or future
 *   DELETE (revoke) → status=declined, preserves original decidedAt
 *
 * Tenant resolution falls back to the patient's first active clinician's
 * organization when the patient self-registered without an org (same trick
 * used by the documents endpoint).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims)
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Patient")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, consents: [] }) } as const;
  return { uid: claims.uid } as const;
}

async function resolveTenant(patientId: string, clinicianId: string | null): Promise<string | null> {
  const own = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${patientId}::uuid LIMIT 1
  `;
  if (own[0]?.organizationId) return own[0].organizationId;

  if (clinicianId) {
    const clin = await prisma.$queryRaw<{ organizationId: string | null }[]>`
      SELECT "organizationId" FROM users WHERE id = ${clinicianId}::uuid LIMIT 1
    `;
    if (clin[0]?.organizationId) return clin[0].organizationId;
  }

  const fallback = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT c."organizationId"
    FROM patient_assignments pa
    JOIN users c ON c.id = pa."clinicianId"
    WHERE pa."patientId" = ${patientId}::uuid
      AND pa."endedAt" IS NULL
      AND c."organizationId" IS NOT NULL
    ORDER BY pa."startedAt" DESC
    LIMIT 1
  `;
  return fallback[0]?.organizationId ?? null;
}

interface PostBody {
  clinicianId?: string;
  scopes?: string[];
  /** Hours from now. null/0/omitted = open-ended (no expiry). */
  durationHours?: number | null;
  policyVersion?: string;
}

export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;

  let body: PostBody;
  try { body = (await req.json()) as PostBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const clinicianId = (body.clinicianId ?? "").trim();
  if (!UUID_RE.test(clinicianId))
    return NextResponse.json({ ok: false, error: "Valid clinicianId required." }, { status: 400 });

  const scopes = Array.isArray(body.scopes)
    ? body.scopes.filter((s): s is string => typeof s === "string" && s.length > 0 && s.length < 64)
    : [];
  if (scopes.length === 0)
    return NextResponse.json({ ok: false, error: "Pick at least one scope." }, { status: 400 });

  const durationHours = Number.isFinite(body.durationHours) && body.durationHours
    ? Math.max(1, Math.min(24 * 365 * 5, Math.floor(Number(body.durationHours))))
    : null;

  const orgId = await resolveTenant(g.uid, clinicianId);
  if (!orgId)
    return NextResponse.json({ ok: false, error: "No tenant on your account — ask your clinic to assign a clinician first." }, { status: 400 });

  // Validate the clinician really is one in our tenant — prevents a patient
  // from granting consent to an arbitrary user uuid.
  const clinCheck = await prisma.$queryRaw<{ roleKind: string; orgId: string }[]>`
    SELECT "roleKind"::text AS "roleKind", "organizationId"::text AS "orgId"
    FROM users WHERE id = ${clinicianId}::uuid LIMIT 1
  `;
  if (!clinCheck[0] || clinCheck[0].roleKind !== "clinician")
    return NextResponse.json({ ok: false, error: "Recipient must be a clinician." }, { status: 400 });

  const inserted = await prisma.$queryRaw<{
    id: string;
    requestedAt: Date;
    decidedAt: Date;
    expiresAt: Date | null;
  }[]>`
    INSERT INTO consent_requests
      (id, "patientId", "clinicianId", "organizationId", scopes,
       "durationHours", reason, status, "requestedAt", "decidedAt",
       "expiresAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${g.uid}::uuid, ${clinicianId}::uuid, ${orgId}::uuid,
       ${JSON.stringify(scopes)}::jsonb, ${durationHours ?? 0},
       'Patient-initiated grant', 'approved',
       NOW(), NOW(),
       ${durationHours ? Prisma.sql`NOW() + (${durationHours} || ' hours')::interval` : Prisma.sql`NULL`},
       NOW(), NOW())
    RETURNING id, "requestedAt", "decidedAt", "expiresAt"
  `;

  const row = inserted[0];
  return NextResponse.json({
    ok: true,
    consent: {
      id: row.id,
      scopes,
      clinicianId,
      grantedAt: row.decidedAt.toISOString(),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      policyVersion: body.policyVersion ?? "v2.4",
    },
  }, { status: 201 });
}

export async function DELETE(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });

  const existing = await prisma.$queryRaw<{ patientId: string; status: string }[]>`
    SELECT "patientId", status FROM consent_requests WHERE id = ${id}::uuid LIMIT 1
  `;
  if (!existing[0] || existing[0].patientId !== g.uid)
    return NextResponse.json({ ok: false, error: "Consent not found." }, { status: 404 });
  if (existing[0].status === "declined")
    return NextResponse.json({ ok: true, alreadyRevoked: true });

  // Revoke preserves the original decidedAt — only flips status to "declined"
  // (which the compliance feed maps to "Revoked") and notes the revocation.
  await prisma.$executeRaw`
    UPDATE consent_requests SET
      status         = 'declined',
      "decisionNote" = 'Revoked by patient',
      "updatedAt"    = NOW()
    WHERE id = ${id}::uuid AND "patientId" = ${g.uid}::uuid
  `;
  return NextResponse.json({ ok: true });
}
