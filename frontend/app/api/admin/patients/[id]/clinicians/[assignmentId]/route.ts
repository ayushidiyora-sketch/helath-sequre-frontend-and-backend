import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { RoleKind } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard(): Promise<
  | { error: NextResponse; orgId?: never }
  | { error?: never; orgId: string }
> {
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

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; assignmentId: string }> },
) {
  const { id, assignmentId } = await ctx.params;
  const g = await guard();
  if (g.error) return g.error;

  if (!UUID_RE.test(id) || !UUID_RE.test(assignmentId)) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const assignment = await prisma.patientAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      patient: { select: { id: true, organizationId: true, roleKind: true, deletedAt: true } },
      clinician: { select: { organizationId: true } },
    },
  });
  if (!assignment || assignment.patientId !== id) {
    return NextResponse.json({ ok: false, error: "Assignment not found." }, { status: 404 });
  }
  if (assignment.endedAt) {
    return NextResponse.json({ ok: false, error: "Assignment is already ended." }, { status: 409 });
  }
  if (
    assignment.patient.deletedAt ||
    assignment.patient.roleKind !== RoleKind.patient
  ) {
    return NextResponse.json({ ok: false, error: "Assignment not found." }, { status: 404 });
  }
  // Only allow ending assignments where either side belongs to this tenant.
  // Self-registered patients (orgId=null) are visible across tenants by design,
  // but the clinician must belong to the admin's tenant.
  if (assignment.clinician.organizationId !== g.orgId) {
    return NextResponse.json({ ok: false, error: "Not allowed in this tenant." }, { status: 403 });
  }

  await prisma.patientAssignment.update({
    where: { id: assignmentId },
    data: { endedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
