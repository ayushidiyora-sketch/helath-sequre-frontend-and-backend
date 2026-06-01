import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { RoleKind } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Lightweight read-only patient list for the appointment-booking dropdown.
 * The full Patient Admin module is still static — this endpoint exists so
 * the schedule page can offer real DB-backed patients without us reviving
 * the full /admin/patients CRUD flow.
 */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Org Admin")
    return NextResponse.json({ ok: false, error: "Forbidden — Org Admin only." }, { status: 403 });
  if (!claims.org)
    return NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 });

  const org = await prisma.organization.findUnique({
    where: { slug: claims.org },
    select: { id: true },
  });
  if (!org) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });

  const rows = await prisma.user.findMany({
    where: {
      // Show patients enrolled into this tenant AND self-registered patients
      // (organizationId = null) — the latter haven't picked a clinic yet at
      // signup, so we surface them on every Org Admin's roster as "Unassigned"
      // for the demo. Real multi-tenancy would gate this behind consent.
      OR: [{ organizationId: org.id }, { organizationId: null }],
      deletedAt: null,
      roleKind: RoleKind.patient,
    },
    // Ordered by enrollment (createdAt) so the synthetic display-MRN
    // derived from row index stays stable across calls.
    orderBy: [{ createdAt: "asc" }],
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
    },
  });

  return NextResponse.json({
    ok: true,
    patients: rows.map((p, i) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
      profilePhotoUrl: p.profilePhotoUrl,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      // Self-registered patients aren't yet bound to a clinic.
      assigned: p.organizationId !== null,
      // Synthetic display ID — there's no `mrn` column on User, so we derive
      // one from the row's enrollment-order index. Format mirrors the demo
      // mock (CG-YYYY-NNNN).
      mrn: `CG-${p.createdAt.getUTCFullYear()}-${String(i + 1).padStart(4, "0")}`,
    })),
  });
}
