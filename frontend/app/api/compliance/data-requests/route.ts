import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Compliance queue for patient-initiated data requests (deletion / export).
 * Lists every `data_requests` row in the signed-in Compliance Manager's tenant,
 * joined to the patient's user row for name / email / MRN. Powers
 * /compliance/deletion-requests.
 */

interface Row {
  id: string;
  type: string;
  status: string;
  channel: string;
  legalHold: boolean;
  legalHoldReason: string | null;
  decisionNote: string | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  requestedAt: Date;
  firstName: string;
  lastName: string;
  email: string;
  patientCreatedAt: Date;
  patientId: string;
}

function shapeRequest(r: Row) {
  return {
    id: r.id,
    patientName: `${r.firstName} ${r.lastName}`.trim(),
    patientMrn: `CG-${r.patientCreatedAt.getUTCFullYear()}-${r.patientId.slice(0, 4).toUpperCase()}`,
    patientEmail: r.email,
    type: r.type,
    status: r.status,
    channel: r.channel,
    legalHold: r.legalHold,
    legalHoldReason: r.legalHoldReason,
    decisionNote: r.decisionNote,
    decidedBy: r.decidedByName,
    requestedAt: r.requestedAt.toISOString(),
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  };
}

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Compliance Manager")
    return NextResponse.json({ ok: false, error: "Forbidden — Compliance only." }, { status: 403 });
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, requests: [] });

  // claims.org is the org slug, not the UUID — resolve the real id from the row.
  const me = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  const orgId = me[0]?.organizationId;
  if (!orgId) return NextResponse.json({ ok: true, requests: [] });

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT d.id, d.type, d.status, d.channel, d."legalHold", d."legalHoldReason",
           d."decisionNote", d."decidedByName", d."decidedAt", d."requestedAt",
           u."firstName", u."lastName", u.email,
           u."createdAt" AS "patientCreatedAt", u.id::text AS "patientId"
    FROM data_requests d
    JOIN users u ON u.id = d."patientId"
    WHERE d."organizationId" = ${orgId}::uuid
    ORDER BY d."requestedAt" DESC
    LIMIT 200
  `;
  return NextResponse.json({ ok: true, requests: rows.map(shapeRequest) });
}
