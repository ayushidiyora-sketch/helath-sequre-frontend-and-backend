import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { RoleKind } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Org Admin")
    return NextResponse.json({ ok: false, error: "Forbidden — Org Admin only." }, { status: 403 });
  if (!claims.org)
    return NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 });
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "Invalid patient id." }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { slug: claims.org },
    select: { id: true },
  });
  if (!org) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });

  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      gender: true,
      dateOfBirth: true,
      profilePhotoUrl: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      mfaEnrolledAt: true,
      mfaRequired: true,
      roleKind: true,
      deletedAt: true,
    },
  });
  if (!u || u.deletedAt || u.roleKind !== RoleKind.patient) {
    return NextResponse.json({ ok: false, error: "Patient not found." }, { status: 404 });
  }
  // Allow visibility into this tenant's patients + self-registered (null-org)
  // patients — matches the list-page behaviour.
  if (u.organizationId !== null && u.organizationId !== org.id) {
    return NextResponse.json({ ok: false, error: "Patient not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    patient: {
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      gender: u.gender,
      dateOfBirth: u.dateOfBirth ? u.dateOfBirth.toISOString().slice(0, 10) : null,
      profilePhotoUrl: u.profilePhotoUrl,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      mfaEnrolled: !!u.mfaEnrolledAt,
      mfaRequired: u.mfaRequired,
      assigned: u.organizationId !== null,
    },
  });
}
