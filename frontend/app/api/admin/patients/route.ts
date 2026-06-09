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

  // Pull active patient↔clinician assignments for the whole roster in one
  // query, then drop them into a Map<patientId, [clinician...]>. "Active"
  // means `endedAt IS NULL`. Primary first so the displayed name is the
  // patient's primary care doctor when multiple assignments exist.
  const patientIds = rows.map((p) => p.id);
  const assignments =
    patientIds.length === 0
      ? []
      : await prisma.patientAssignment.findMany({
          where: { patientId: { in: patientIds }, endedAt: null },
          orderBy: [{ role: "asc" }, { startedAt: "desc" }],
          select: {
            patientId: true,
            role: true,
            clinician: {
              select: { id: true, firstName: true, lastName: true, designation: true },
            },
          },
        });
  const byPatient = new Map<string, { name: string; designation: string | null }[]>();
  for (const a of assignments) {
    const list = byPatient.get(a.patientId) ?? [];
    const full = `${a.clinician.firstName} ${a.clinician.lastName}`.trim();
    list.push({ name: full || "Unknown clinician", designation: a.clinician.designation ?? null });
    byPatient.set(a.patientId, list);
  }

  return NextResponse.json({
    ok: true,
    patients: rows.map((p, i) => {
      const docs = byPatient.get(p.id) ?? [];
      const primary = docs[0] ?? null;
      // "Dr." prefix only if the doctor's first name doesn't already start with it
      const docLabel = primary
        ? /^dr\.?\s/i.test(primary.name)
          ? primary.name
          : `Dr. ${primary.name}`
        : null;
      return {
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
        // `assigned` now reflects ACTUAL clinician assignment — not just
        // "patient has an org". Drives the "Unassigned" badge.
        assigned: docs.length > 0,
        assignedDoctor: docLabel,
        assignedDoctorDesignation: primary?.designation ?? null,
        assignedDoctorsCount: docs.length,
        // Synthetic display ID — there's no `mrn` column on User, so we derive
        // one from the row's enrollment-order index. Format mirrors the demo
        // mock (CG-YYYY-NNNN).
        mrn: `CG-${p.createdAt.getUTCFullYear()}-${String(i + 1).padStart(4, "0")}`,
      };
    }),
  });
}
