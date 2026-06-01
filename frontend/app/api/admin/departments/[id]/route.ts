import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma, RoleKind } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function requireOrgAdmin() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Org Admin")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Org Admin only." }, { status: 403 }) };
  if (!claims.org)
    return { error: NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 }) };
  const org = await prisma.organization.findUnique({ where: { slug: claims.org }, select: { id: true } });
  if (!org) return { error: NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 }) };
  return { orgId: org.id };
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireOrgAdmin();
  if ("error" in guard && guard.error) return guard.error;
  const orgId = (guard as { orgId: string }).orgId;

  // Must belong to this tenant.
  const dept = await prisma.department.findFirst({
    where: { id, organizationId: orgId, deletedAt: null },
    include: { _count: { select: { children: { where: { deletedAt: null } } } } },
  });
  if (!dept) {
    return NextResponse.json({ ok: false, error: "Department not found." }, { status: 404 });
  }

  // Refuse delete if any child departments exist OR clinicians reference this name.
  if (dept._count.children > 0) {
    return NextResponse.json(
      { ok: false, error: "Cannot delete: department has sub-departments. Remove or reparent them first." },
      { status: 409 },
    );
  }
  const clinicianCount = await prisma.user.count({
    where: {
      organizationId: orgId,
      deletedAt: null,
      roleKind: RoleKind.clinician,
      department: dept.name,
    },
  });
  if (clinicianCount > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `Cannot delete: ${clinicianCount} clinician${clinicianCount === 1 ? "" : "s"} still assigned. Reassign them first.`,
      },
      { status: 409 },
    );
  }

  try {
    // Soft-delete to preserve audit history.
    await prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Department not found." }, { status: 404 });
    }
    throw err;
  }
}
