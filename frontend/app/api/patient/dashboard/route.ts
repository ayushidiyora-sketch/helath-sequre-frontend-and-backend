import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { RoleKind } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });
  // Demo-user session (uid like "u_patient_ayushi") — return an empty payload
  // so the page renders without P2023'ing on a non-UUID id.
  if (!isDbUid(claims.uid)) {
    return NextResponse.json({
      ok: true,
      me: { id: claims.uid, name: claims.name, email: claims.email, mrn: null, dateOfBirth: null, profilePhotoUrl: null, organization: null },
      nextAppointment: null,
      pastAppointments: [],
      activePrescriptions: [],
      consents: [],
    });
  }

  const me = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      gender: true,
      dateOfBirth: true,
      profilePhotoUrl: true,
      organizationId: true,
      createdAt: true,
      mfaEnrolledAt: true,
      mfaRequired: true,
      organization: { select: { name: true } },
      roleKind: true,
    },
  });
  if (!me || me.roleKind !== RoleKind.patient)
    return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 });

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  // Appointments today/future for this patient (booked against their email).
  // Raw SQL so we tolerate the new `arrived` / `in_progress` enum values — the
  // generated Prisma client doesn't know them yet (Windows DLL lock prevents
  // `prisma generate`), so any include/select that pulls status would throw.
  interface UpcomingRow {
    id: string;
    startsAt: Date;
    durationMinutes: number;
    room: string | null;
    status: string;
    notes: string | null;
    clinicianFirstName: string | null;
    clinicianLastName: string | null;
    clinicianDesignation: string | null;
    clinicianDepartment: string | null;
  }
  const [upcoming, past, careTeam] = await Promise.all([
    prisma.$queryRaw<UpcomingRow[]>`
      SELECT a.id, a."startsAt", a."durationMinutes", a.room,
             a.status::text AS status, a.notes,
             u."firstName"   AS "clinicianFirstName",
             u."lastName"    AS "clinicianLastName",
             u.designation   AS "clinicianDesignation",
             u.department    AS "clinicianDepartment"
      FROM appointments a
      JOIN users u ON u.id = a."clinicianId"
      WHERE a."patientEmail" = ${me.email}
        AND a."deletedAt" IS NULL
        AND a."startsAt" >= ${dayStart}
        AND a.status NOT IN ('cancelled','no_show')
      ORDER BY a."startsAt" ASC
      LIMIT 10
    `,
    prisma.appointment.count({
      where: {
        patientEmail: me.email,
        deletedAt: null,
        startsAt: { lt: dayStart },
      },
    }),
    prisma.patientAssignment.findMany({
      where: { patientId: me.id, endedAt: null },
      orderBy: { startedAt: "desc" },
      include: {
        clinician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
            department: true,
            profilePhotoUrl: true,
          },
        },
      },
    }),
  ]);

  const next = upcoming[0] ?? null;

  // Synthetic MRN — first 8 chars of the patient UUID, prefixed.
  const mrn = `CG-${me.createdAt.getUTCFullYear()}-${me.id.slice(0, 4).toUpperCase()}`;

  return NextResponse.json({
    ok: true,
    profile: {
      id: me.id,
      firstName: me.firstName,
      lastName: me.lastName,
      name: `${me.firstName} ${me.lastName}`.trim(),
      initials: ((me.firstName[0] ?? "") + (me.lastName[0] ?? "")).toUpperCase(),
      email: me.email,
      phone: me.phone,
      gender: me.gender,
      dateOfBirth: me.dateOfBirth ? me.dateOfBirth.toISOString().slice(0, 10) : null,
      profilePhotoUrl: me.profilePhotoUrl,
      tenantName: me.organization?.name ?? null,
      mfaEnrolled: !!me.mfaEnrolledAt,
      mfaRequired: me.mfaRequired,
      mrn,
      enrolledAt: me.createdAt.toISOString(),
    },
    stats: {
      upcomingCount: upcoming.length,
      pastCount: past,
      careTeamSize: careTeam.length,
      documents: 0,
      activeConsents: careTeam.length,
      unreadMessages: 0,
    },
    next: next
      ? {
          id: next.id,
          startsAt: next.startsAt.toISOString(),
          date: next.startsAt.toISOString().slice(0, 10),
          time: next.startsAt.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
          durationMinutes: next.durationMinutes,
          room: next.room,
          status: next.status,
          notes: next.notes,
          clinician: `Dr. ${[next.clinicianFirstName, next.clinicianLastName].filter(Boolean).join(" ")}`.trim(),
          clinicianDepartment: next.clinicianDepartment,
          clinicianDesignation: next.clinicianDesignation,
        }
      : null,
    upcoming: upcoming.map((a) => ({
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      date: a.startsAt.toISOString().slice(0, 10),
      time: a.startsAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      durationMinutes: a.durationMinutes,
      room: a.room,
      status: a.status,
      notes: a.notes,
      clinician: `Dr. ${[a.clinicianFirstName, a.clinicianLastName].filter(Boolean).join(" ")}`.trim(),
      clinicianDepartment: a.clinicianDepartment,
    })),
    careTeam: careTeam.map((c) => ({
      assignmentId: c.id,
      role: c.role,
      startedAt: c.startedAt.toISOString(),
      clinician: {
        id: c.clinician.id,
        name: `Dr. ${c.clinician.firstName} ${c.clinician.lastName}`.trim(),
        firstName: c.clinician.firstName,
        lastName: c.clinician.lastName,
        initials: ((c.clinician.firstName[0] ?? "") + (c.clinician.lastName[0] ?? "")).toUpperCase(),
        email: c.clinician.email,
        designation: c.clinician.designation,
        department: c.clinician.department,
        profilePhotoUrl: c.clinician.profilePhotoUrl,
      },
    })),
  });
}
