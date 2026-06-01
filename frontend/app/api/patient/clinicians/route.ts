import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { RoleKind, UserStatus } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function yearsSince(date: Date | null): number {
  if (!date) return 0;
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) years--;
  return Math.max(0, years);
}

/**
 * Clinicians available for a patient to book.
 *
 * Priority:
 *   1. The patient's existing care team (active `PatientAssignment`) — surfaced
 *      first and marked `isAssigned: true`.
 *   2. Other active clinicians in the patient's tenant (or, if the patient is
 *      self-registered with no org yet, all active clinicians across tenants).
 */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });

  const me = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { id: true, organizationId: true },
  });
  if (!me) return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 });

  const [assignments, pool] = await Promise.all([
    prisma.patientAssignment.findMany({
      where: { patientId: me.id, endedAt: null },
      include: {
        clinician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: true,
            workLocation: true,
            profilePhotoUrl: true,
            joiningDate: true,
            status: true,
            organization: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        roleKind: RoleKind.clinician,
        deletedAt: null,
        status: { in: [UserStatus.active, UserStatus.invited] },
        ...(me.organizationId ? { organizationId: me.organizationId } : {}),
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        designation: true,
        department: true,
        workLocation: true,
        profilePhotoUrl: true,
        joiningDate: true,
        status: true,
        organization: { select: { name: true } },
      },
    }),
  ]);

  const assignedIds = new Set(assignments.map((a) => a.clinician.id));

  type Row = {
    id: string;
    name: string;
    initials: string;
    designation: string | null;
    department: string | null;
    workLocation: string | null;
    profilePhotoUrl: string | null;
    experienceYears: number;
    tenantName: string | null;
    isAssigned: boolean;
  };

  function shape(c: {
    id: string;
    firstName: string;
    lastName: string;
    designation: string | null;
    department: string | null;
    workLocation: string | null;
    profilePhotoUrl: string | null;
    joiningDate: Date | null;
    organization: { name: string } | null;
  }, isAssigned: boolean): Row {
    return {
      id: c.id,
      name: `Dr. ${c.firstName} ${c.lastName}`.trim(),
      initials: ((c.firstName[0] ?? "") + (c.lastName[0] ?? "")).toUpperCase(),
      designation: c.designation,
      department: c.department,
      workLocation: c.workLocation,
      profilePhotoUrl: c.profilePhotoUrl,
      experienceYears: yearsSince(c.joiningDate),
      tenantName: c.organization?.name ?? null,
      isAssigned,
    };
  }

  const careTeam: Row[] = assignments.map((a) => shape(a.clinician, true));
  const others: Row[] = pool
    .filter((c) => !assignedIds.has(c.id))
    .map((c) => shape(c, false));

  return NextResponse.json({
    ok: true,
    clinicians: [...careTeam, ...others],
  });
}
