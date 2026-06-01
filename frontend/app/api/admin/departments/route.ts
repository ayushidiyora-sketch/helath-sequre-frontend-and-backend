import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma, RoleKind } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface CreateBody {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  defaultSlotMinutes?: number;
}

type Guard =
  | { error: NextResponse; claims?: never; orgId?: never }
  | { error?: never; claims: { uid: string; role: string; org: string }; orgId: string };

async function requireOrgAdmin(): Promise<Guard> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Org Admin")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Org Admin only." }, { status: 403 }) };
  if (!claims.org)
    return { error: NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 }) };

  const org = await prisma.organization.findUnique({ where: { slug: claims.org }, select: { id: true } });
  if (!org) return { error: NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 }) };
  return {
    claims: { uid: claims.uid, role: claims.role, org: claims.org },
    orgId: org.id,
  };
}

interface PublicDepartment {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  defaultSlotMinutes: number;
  clinicianCount: number;
  childCount: number;
  createdAt: string;
}

export async function GET() {
  const guard = await requireOrgAdmin();
  if (guard.error) return guard.error;

  const rows = await prisma.department.findMany({
    where: { organizationId: guard.orgId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      parent: { select: { name: true } },
      _count: { select: { children: { where: { deletedAt: null } } } },
    },
  });

  // Tally clinicians per department name (User.department is a free-form
  // string mapping by name, not a FK yet).
  const clinicianRows = await prisma.user.groupBy({
    by: ["department"],
    where: {
      organizationId: guard.orgId,
      deletedAt: null,
      roleKind: RoleKind.clinician,
      department: { not: null },
    },
    _count: { _all: true },
  });
  const byDeptName = new Map<string, number>();
  for (const r of clinicianRows) {
    if (r.department) byDeptName.set(r.department, r._count._all);
  }

  const out: PublicDepartment[] = rows.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    parentId: d.parentId,
    parentName: d.parent?.name ?? null,
    defaultSlotMinutes: d.defaultSlotMinutes,
    clinicianCount: byDeptName.get(d.name) ?? 0,
    childCount: d._count.children,
    createdAt: d.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, departments: out });
}

export async function POST(req: Request) {
  const guard = await requireOrgAdmin();
  if (guard.error) return guard.error;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "Department name must be at least 2 characters." }, { status: 400 });
  }
  const slotMin = body.defaultSlotMinutes ?? 30;
  if (!Number.isInteger(slotMin) || slotMin < 5 || slotMin > 240) {
    return NextResponse.json({ ok: false, error: "Default slot length must be between 5 and 240 minutes." }, { status: 400 });
  }

  // Validate the parent (must exist in this tenant).
  let parentId: string | null = null;
  if (body.parentId && body.parentId.trim()) {
    const parent = await prisma.department.findFirst({
      where: { id: body.parentId.trim(), organizationId: guard.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json({ ok: false, error: "Parent department not found in this tenant." }, { status: 400 });
    }
    parentId = parent.id;
  }

  try {
    const created = await prisma.department.create({
      data: {
        organizationId: guard.orgId,
        name,
        description: body.description?.trim() || null,
        parentId,
        defaultSlotMinutes: slotMin,
      },
      include: {
        parent: { select: { name: true } },
      },
    });
    return NextResponse.json(
      {
        ok: true,
        department: {
          id: created.id,
          name: created.name,
          description: created.description,
          parentId: created.parentId,
          parentName: created.parent?.name ?? null,
          defaultSlotMinutes: created.defaultSlotMinutes,
          clinicianCount: 0,
          childCount: 0,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: `A department named "${name}" already exists in this tenant.` },
        { status: 409 },
      );
    }
    throw err;
  }
}
