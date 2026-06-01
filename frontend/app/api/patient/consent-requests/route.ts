import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RequestRow {
  id: string;
  patientId: string;
  clinicianId: string;
  scopes: Prisma.JsonValue;
  durationHours: number;
  reason: string;
  status: string;
  requestedAt: Date;
  decidedAt: Date | null;
  decisionNote: string | null;
  clinicianFirstName: string;
  clinicianLastName: string;
  clinicianDepartment: string | null;
  clinicianDesignation: string | null;
}

async function guardPatient() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Patient")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 }) } as const;
  return { claims } as const;
}

function readScopes(raw: Prisma.JsonValue): string[] {
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === "string");
  return [];
}

function shape(r: RequestRow) {
  return {
    id: r.id,
    patientId: r.patientId,
    clinicianId: r.clinicianId,
    clinicianName: `Dr. ${r.clinicianFirstName} ${r.clinicianLastName}`.trim(),
    clinicianDepartment: r.clinicianDepartment ?? r.clinicianDesignation ?? "Care team",
    scopes: readScopes(r.scopes),
    durationHours: Number(r.durationHours),
    reason: r.reason,
    status: r.status,
    requestedAt: r.requestedAt.toISOString(),
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    decisionNote: r.decisionNote,
  };
}

/** GET — pending + recent consent requests for the signed-in patient. */
export async function GET() {
  const g = await guardPatient();
  if ("error" in g) return g.error;
  const rows = await prisma.$queryRaw<RequestRow[]>`
    SELECT cr.id, cr."patientId", cr."clinicianId", cr.scopes,
           cr."durationHours", cr.reason, cr.status,
           cr."requestedAt", cr."decidedAt", cr."decisionNote",
           u."firstName"   AS "clinicianFirstName",
           u."lastName"    AS "clinicianLastName",
           u.department    AS "clinicianDepartment",
           u.designation   AS "clinicianDesignation"
    FROM consent_requests cr
    JOIN users u ON u.id = cr."clinicianId"
    WHERE cr."patientId" = ${g.claims.uid}::uuid
    ORDER BY cr.status = 'pending' DESC, cr."requestedAt" DESC
    LIMIT 50
  `;
  return NextResponse.json({ ok: true, requests: rows.map(shape) });
}

interface PatchBody {
  id?: string;
  /** "approved" | "declined" */
  decision?: "approved" | "declined";
  note?: string;
}

/** PATCH — patient approves or declines a pending request by id. */
export async function PATCH(req: Request) {
  const g = await guardPatient();
  if ("error" in g) return g.error;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const id = body.id?.trim() ?? "";
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid request id." }, { status: 400 });
  const decision = body.decision;
  if (decision !== "approved" && decision !== "declined")
    return NextResponse.json({ ok: false, error: "decision must be approved or declined." }, { status: 400 });

  const existing = await prisma.$queryRaw<
    { id: string; status: string; patientId: string; durationHours: number }[]
  >`
    SELECT id, status, "patientId", "durationHours"
    FROM consent_requests WHERE id = ${id}::uuid LIMIT 1
  `;
  const row = existing[0];
  if (!row || row.patientId !== g.claims.uid)
    return NextResponse.json({ ok: false, error: "Request not found." }, { status: 404 });
  if (row.status !== "pending")
    return NextResponse.json(
      { ok: false, error: `Request is already ${row.status}.` },
      { status: 409 },
    );

  // On approve, stamp expiresAt = now + durationHours. Decline leaves it null.
  await prisma.$executeRaw`
    UPDATE consent_requests SET
      status         = ${decision},
      "decidedAt"    = NOW(),
      "decisionNote" = ${body.note?.toString().trim() || null},
      "expiresAt"    = ${
        decision === "approved"
          ? Prisma.sql`NOW() + (${row.durationHours} || ' hours')::interval`
          : Prisma.sql`NULL`
      },
      "updatedAt"    = NOW()
    WHERE id = ${id}::uuid
  `;
  return NextResponse.json({ ok: true });
}
