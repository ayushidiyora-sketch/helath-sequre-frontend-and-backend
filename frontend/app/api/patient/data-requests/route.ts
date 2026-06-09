import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Patient-initiated GDPR/HIPAA data requests (right-to-be-forgotten +
 * right-of-access). A `deletion` or `export` request is written to
 * `data_requests` and surfaces on the Compliance Manager's "Patient data
 * requests" queue for review. Stamped with the patient's tenant so it routes
 * to the right Compliance team (own org, else the care-team clinician's org).
 */

const TYPES = new Set(["deletion", "export"]);
const OPEN = ["pending", "in_progress"];

interface Row {
  id: string;
  type: string;
  status: string;
  requestedAt: Date;
}

async function resolveOrg(uid: string): Promise<string | null> {
  const me = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${uid}::uuid LIMIT 1
  `;
  if (me[0]?.organizationId) return me[0].organizationId;
  // Self-registered patients have no org → use the care-team clinician's tenant.
  const ct = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT c."organizationId"
    FROM patient_assignments pa
    JOIN users c ON c.id = pa."clinicianId"
    WHERE pa."patientId" = ${uid}::uuid AND pa."endedAt" IS NULL
    ORDER BY pa."startedAt" DESC
    LIMIT 1
  `;
  return ct[0]?.organizationId ?? null;
}

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, requests: [] });

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, type, status, "requestedAt"
    FROM data_requests
    WHERE "patientId" = ${claims.uid}::uuid
    ORDER BY "requestedAt" DESC
    LIMIT 20
  `;
  return NextResponse.json({
    ok: true,
    requests: rows.map((r) => ({ id: r.id, type: r.type, status: r.status, requestedAt: r.requestedAt.toISOString() })),
  });
}

export async function POST(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });
  if (!isDbUid(claims.uid))
    return NextResponse.json({ ok: false, error: "Demo account — sign in with a real account to submit a request." }, { status: 400 });

  let body: { type?: string };
  try { body = (await req.json()) as { type?: string }; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }
  const type = TYPES.has(body.type ?? "") ? body.type! : null;
  if (!type) return NextResponse.json({ ok: false, error: "type must be 'deletion' or 'export'." }, { status: 400 });

  // Don't pile up duplicates — return the existing open request of this type.
  const existing = await prisma.$queryRaw<Row[]>`
    SELECT id, type, status, "requestedAt"
    FROM data_requests
    WHERE "patientId" = ${claims.uid}::uuid AND type = ${type} AND status IN ('pending','in_progress')
    ORDER BY "requestedAt" DESC
    LIMIT 1
  `;
  if (existing[0]) {
    return NextResponse.json({ ok: true, alreadyOpen: true, request: { id: existing[0].id, type, status: existing[0].status } });
  }

  const orgId = await resolveOrg(claims.uid);
  // Export requests start as in_progress (the bundle generates immediately);
  // deletions start pending until a Compliance Manager reviews.
  const status = type === "export" ? "in_progress" : "pending";

  const inserted = await prisma.$queryRaw<Row[]>`
    INSERT INTO data_requests
      (id, "patientId", "organizationId", type, status, channel, "requestedAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${claims.uid}::uuid, ${orgId}::uuid, ${type}, ${status}, 'Patient portal', NOW(), NOW(), NOW())
    RETURNING id, type, status, "requestedAt"
  `;
  return NextResponse.json({ ok: true, request: { id: inserted[0].id, type, status } }, { status: 201 });
}
