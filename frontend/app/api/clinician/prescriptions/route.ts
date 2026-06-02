import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
}

async function guardClinician() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Clinician")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, prescriptions: [] }) } as const;
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

/**
 * GET — list this clinician's prescriptions, optionally scoped by ?patientId.
 *
 * Uses $queryRaw so the route works while the local Prisma client cache is
 * stale (the `Prescription` model exists in Postgres after `db push`, but the
 * runtime engine validates against `node_modules/.prisma/client/schema.prisma`
 * which doesn't yet know about the model — same pattern as the availability
 * + slots routes). Postgres column names follow Prisma's field names verbatim
 * (camelCase); using snake_case here silently returns no rows.
 */
export async function GET(req: Request) {
  const g = await guardClinician();
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");
  if (patientId && !UUID_RE.test(patientId))
    return NextResponse.json({ ok: false, error: "Invalid patientId." }, { status: 400 });

  const rows = patientId
    ? await prisma.$queryRaw<PrescriptionRow[]>`
        SELECT id, "patientId", "clinicianId", "drugName", strength, route, frequency,
               duration, refills, "patientInstructions", status,
               "createdAt", "updatedAt", "finalizedAt"
        FROM prescriptions
        WHERE "clinicianId" = ${g.claims.uid}::uuid
          AND "patientId" = ${patientId}::uuid
          AND "deletedAt" IS NULL
        ORDER BY status ASC, "createdAt" DESC
      `
    : await prisma.$queryRaw<PrescriptionRow[]>`
        SELECT id, "patientId", "clinicianId", "drugName", strength, route, frequency,
               duration, refills, "patientInstructions", status,
               "createdAt", "updatedAt", "finalizedAt"
        FROM prescriptions
        WHERE "clinicianId" = ${g.claims.uid}::uuid
          AND "deletedAt" IS NULL
        ORDER BY status ASC, "createdAt" DESC
      `;
  return NextResponse.json({ ok: true, prescriptions: rows.map(shape) });
}

interface PostBody {
  patientId?: string;
  drugName?: string;
}

/**
 * POST — provision a new draft prescription so the compose page has an id to
 * navigate to. Validates clinician + patient roles via a raw SELECT against
 * the users table (camelCase columns, see scheduleTemplate notes).
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

  const clinicianRows = await prisma.$queryRaw<
    { id: string; organizationId: string | null; roleKind: string }[]
  >`
    SELECT id, "organizationId", "roleKind"::text AS "roleKind"
    FROM users
    WHERE id = ${g.claims.uid}::uuid AND "deletedAt" IS NULL
    LIMIT 1
  `;
  const clinician = clinicianRows[0];
  if (!clinician || clinician.roleKind !== "clinician")
    return NextResponse.json({ ok: false, error: "Clinician not found." }, { status: 404 });
  if (!clinician.organizationId)
    return NextResponse.json({ ok: false, error: "Clinician has no tenant." }, { status: 400 });

  const patientRows = await prisma.$queryRaw<{ id: string; roleKind: string }[]>`
    SELECT id, "roleKind"::text AS "roleKind"
    FROM users
    WHERE id = ${patientId}::uuid AND "deletedAt" IS NULL
    LIMIT 1
  `;
  if (!patientRows[0] || patientRows[0].roleKind !== "patient")
    return NextResponse.json({ ok: false, error: "Patient not found." }, { status: 404 });

  const drugName = body.drugName?.trim() || "New prescription";
  const inserted = await prisma.$queryRaw<PrescriptionRow[]>`
    INSERT INTO prescriptions
      (id, "patientId", "clinicianId", "organizationId", "drugName", refills, status, "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${patientId}::uuid, ${g.claims.uid}::uuid, ${clinician.organizationId}::uuid,
       ${drugName}, 0, 'draft', NOW(), NOW())
    RETURNING id, "patientId", "clinicianId", "drugName", strength, route, frequency,
              duration, refills, "patientInstructions", status,
              "createdAt", "updatedAt", "finalizedAt"
  `;
  return NextResponse.json({ ok: true, prescription: shape(inserted[0]) }, { status: 201 });
}
