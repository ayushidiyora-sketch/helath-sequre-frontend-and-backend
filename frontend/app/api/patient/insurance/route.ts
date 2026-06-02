import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const COVERAGE = new Set(["Self", "Family", "Spouse", "Children"]);
const PREAUTH = new Set(["none", "pending", "approved", "denied"]);

interface Row {
  id: string;
  provider: string;
  planName: string;
  policyNumberMasked: string;
  groupNumber: string | null;
  memberId: string | null;
  coverageType: string;
  startDate: Date;
  endDate: Date | null;
  isPrimary: boolean;
  cardFrontFileName: string | null;
  cardBackFileName: string | null;
  preAuthorizationStatus: string;
  notes: string | null;
  addedAt: Date;
}

function shape(r: Row) {
  return {
    id: r.id,
    provider: r.provider,
    planName: r.planName,
    policyNumberMasked: r.policyNumberMasked,
    groupNumber: r.groupNumber ?? undefined,
    memberId: r.memberId ?? undefined,
    coverageType: r.coverageType,
    startDate: r.startDate.toISOString().slice(0, 10),
    endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : undefined,
    isPrimary: r.isPrimary,
    cardFrontFileName: r.cardFrontFileName ?? undefined,
    cardBackFileName: r.cardBackFileName ?? undefined,
    preAuthorizationStatus: r.preAuthorizationStatus,
    notes: r.notes ?? undefined,
    addedAt: r.addedAt.toISOString(),
  };
}

async function guard() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  if (claims.role !== "Patient")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 }) } as const;
  if (!isDbUid(claims.uid))
    return { error: NextResponse.json({ ok: true, plans: [] }) } as const;
  return { uid: claims.uid } as const;
}

interface Body {
  id?: string;
  provider?: string;
  planName?: string;
  policyNumberMasked?: string;
  groupNumber?: string | null;
  memberId?: string | null;
  coverageType?: string;
  startDate?: string;
  endDate?: string | null;
  isPrimary?: boolean;
  preAuthorizationStatus?: string;
  notes?: string | null;
  /** When set, ignore other fields and just flip primary to this id. */
  setPrimary?: boolean;
}

function validate(body: Body) {
  const provider = (body.provider ?? "").trim();
  const planName = (body.planName ?? "").trim();
  const policy = (body.policyNumberMasked ?? "").trim();
  if (!provider || !planName || !policy) return { error: "Provider, plan, and policy number are required." };
  const coverage = COVERAGE.has(body.coverageType ?? "") ? body.coverageType! : "Self";
  const preauth = PREAUTH.has(body.preAuthorizationStatus ?? "") ? body.preAuthorizationStatus! : "none";
  const startDate = body.startDate ? new Date(body.startDate) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return { error: "Invalid start date." };
  const endDate = body.endDate ? new Date(body.endDate) : null;
  if (endDate && Number.isNaN(endDate.getTime())) return { error: "Invalid end date." };
  return { clean: { provider, planName, policy, coverage, preauth, startDate, endDate } };
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, provider, "planName", "policyNumberMasked", "groupNumber", "memberId",
           "coverageType", "startDate", "endDate", "isPrimary",
           "cardFrontFileName", "cardBackFileName", "preAuthorizationStatus",
           notes, "addedAt"
    FROM insurance_plans
    WHERE "patientId" = ${g.uid}::uuid
    ORDER BY "isPrimary" DESC, "addedAt" DESC
  `;
  return NextResponse.json({ ok: true, plans: rows.map(shape) });
}

export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  let body: Body;
  try { body = (await req.json()) as Body; } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const v = validate(body);
  if (v.error || !v.clean) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  // If this is the first plan OR isPrimary flag set, ensure no other plan is primary.
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM insurance_plans WHERE "patientId" = ${g.uid}::uuid LIMIT 1
  `;
  const makePrimary = existing.length === 0 || !!body.isPrimary;
  if (makePrimary) {
    await prisma.$executeRaw`
      UPDATE insurance_plans SET "isPrimary" = false, "updatedAt" = NOW()
      WHERE "patientId" = ${g.uid}::uuid
    `;
  }

  const inserted = await prisma.$queryRaw<Row[]>`
    INSERT INTO insurance_plans
      (id, "patientId", provider, "planName", "policyNumberMasked", "groupNumber", "memberId",
       "coverageType", "startDate", "endDate", "isPrimary",
       "preAuthorizationStatus", notes, "addedAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${g.uid}::uuid, ${v.clean.provider}, ${v.clean.planName}, ${v.clean.policy},
       ${body.groupNumber?.trim() || null}, ${body.memberId?.trim() || null},
       ${v.clean.coverage}, ${v.clean.startDate}, ${v.clean.endDate},
       ${makePrimary}, ${v.clean.preauth}, ${body.notes?.trim() || null},
       NOW(), NOW(), NOW())
    RETURNING id, provider, "planName", "policyNumberMasked", "groupNumber", "memberId",
              "coverageType", "startDate", "endDate", "isPrimary",
              "cardFrontFileName", "cardBackFileName", "preAuthorizationStatus",
              notes, "addedAt"
  `;
  return NextResponse.json({ ok: true, plan: shape(inserted[0]) }, { status: 201 });
}

export async function PATCH(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  let body: Body;
  try { body = (await req.json()) as Body; } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const id = body.id?.trim() ?? "";
  if (!isDbUid(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });

  // setPrimary-only PATCH skips field validation.
  if (body.setPrimary) {
    await prisma.$executeRaw`
      UPDATE insurance_plans SET "isPrimary" = false, "updatedAt" = NOW()
      WHERE "patientId" = ${g.uid}::uuid
    `;
    const rows = await prisma.$queryRaw<Row[]>`
      UPDATE insurance_plans SET "isPrimary" = true, "updatedAt" = NOW()
      WHERE id = ${id}::uuid AND "patientId" = ${g.uid}::uuid
      RETURNING id, provider, "planName", "policyNumberMasked", "groupNumber", "memberId",
                "coverageType", "startDate", "endDate", "isPrimary",
                "cardFrontFileName", "cardBackFileName", "preAuthorizationStatus",
                notes, "addedAt"
    `;
    if (rows.length === 0) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, plan: shape(rows[0]) });
  }

  const v = validate(body);
  if (v.error || !v.clean) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  const rows = await prisma.$queryRaw<Row[]>`
    UPDATE insurance_plans SET
      provider = ${v.clean.provider},
      "planName" = ${v.clean.planName},
      "policyNumberMasked" = ${v.clean.policy},
      "groupNumber" = ${body.groupNumber?.trim() || null},
      "memberId" = ${body.memberId?.trim() || null},
      "coverageType" = ${v.clean.coverage},
      "startDate" = ${v.clean.startDate},
      "endDate" = ${v.clean.endDate},
      "preAuthorizationStatus" = ${v.clean.preauth},
      notes = ${body.notes?.trim() || null},
      "updatedAt" = NOW()
    WHERE id = ${id}::uuid AND "patientId" = ${g.uid}::uuid
    RETURNING id, provider, "planName", "policyNumberMasked", "groupNumber", "memberId",
              "coverageType", "startDate", "endDate", "isPrimary",
              "cardFrontFileName", "cardBackFileName", "preAuthorizationStatus",
              notes, "addedAt"
  `;
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, plan: shape(rows[0]) });
}

export async function DELETE(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!isDbUid(id)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  // If deleting the primary, the next-oldest plan becomes primary.
  const deleted = await prisma.$queryRaw<{ wasPrimary: boolean }[]>`
    DELETE FROM insurance_plans
    WHERE id = ${id}::uuid AND "patientId" = ${g.uid}::uuid
    RETURNING "isPrimary" AS "wasPrimary"
  `;
  if (deleted[0]?.wasPrimary) {
    await prisma.$executeRaw`
      UPDATE insurance_plans SET "isPrimary" = true, "updatedAt" = NOW()
      WHERE id = (
        SELECT id FROM insurance_plans
        WHERE "patientId" = ${g.uid}::uuid
        ORDER BY "addedAt" ASC
        LIMIT 1
      )
    `;
  }
  return NextResponse.json({ ok: true });
}
