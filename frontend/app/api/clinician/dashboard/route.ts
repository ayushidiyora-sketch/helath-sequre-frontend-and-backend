import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AppointmentStatus, RoleKind } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Clinician")
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 });
  // Demo-user session (uid like "u_clinician_priya") — no Postgres row exists.
  // Return an empty dashboard payload so the page renders without 500.
  if (!isDbUid(claims.uid)) {
    return NextResponse.json({
      ok: true,
      me: { id: claims.uid, name: claims.name, email: claims.email, designation: null, department: null, profilePhotoUrl: null, organization: null },
      today: { appointments: [], patientsSeen: 0, prescriptionsWritten: 0, notesSigned: 0 },
      upcoming: [],
      pendingTasks: [],
    });
  }

  const me = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      email: true,
      designation: true,
      department: true,
      profilePhotoUrl: true,
      organization: { select: { name: true } },
    },
  });
  if (!me) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  // Today's window in the server's local timezone — Indian clinic demo runs on
  // local clock. Matches what the booking UI writes via local Date strings.
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [todayAppointments, panelAssignments, totalActiveAssignments] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clinicianId: me.id,
        deletedAt: null,
        startsAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        patientName: true,
        patientEmail: true,
        startsAt: true,
        durationMinutes: true,
        room: true,
        status: true,
        notes: true,
      },
    }),
    prisma.patientAssignment.findMany({
      where: { clinicianId: me.id, endedAt: null },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            gender: true,
            dateOfBirth: true,
            profilePhotoUrl: true,
            status: true,
          },
        },
      },
    }),
    prisma.patientAssignment.count({
      where: { clinicianId: me.id, endedAt: null },
    }),
  ]);

  const completedToday = todayAppointments.filter(
    (a) => a.status === AppointmentStatus.completed,
  ).length;
  const nextUp = todayAppointments.find(
    (a) =>
      a.status !== AppointmentStatus.completed &&
      a.status !== AppointmentStatus.cancelled &&
      a.status !== AppointmentStatus.no_show &&
      a.status !== AppointmentStatus.blocked,
  );

  return NextResponse.json({
    ok: true,
    profile: {
      id: me.id,
      firstName: me.firstName,
      lastName: me.lastName,
      email: me.email,
      designation: me.designation,
      department: me.department,
      profilePhotoUrl: me.profilePhotoUrl,
      tenantName: me.organization?.name ?? null,
    },
    stats: {
      todayCount: todayAppointments.length,
      completedToday,
      panelSize: totalActiveAssignments,
      pendingTasks: 0,
      activePrescriptions: 0,
    },
    todayAppointments: todayAppointments.map((a) => ({
      id: a.id,
      patientName: a.patientName,
      patientEmail: a.patientEmail,
      startsAt: a.startsAt.toISOString(),
      time: a.startsAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      durationMinutes: a.durationMinutes,
      room: a.room,
      status: a.status,
      notes: a.notes,
    })),
    panelPatients: panelAssignments.map((a) => ({
      id: a.patient.id,
      assignmentId: a.id,
      role: a.role,
      startedAt: a.startedAt.toISOString(),
      name: `${a.patient.firstName} ${a.patient.lastName}`.trim(),
      firstName: a.patient.firstName,
      lastName: a.patient.lastName,
      email: a.patient.email,
      gender: a.patient.gender,
      dateOfBirth: a.patient.dateOfBirth
        ? a.patient.dateOfBirth.toISOString().slice(0, 10)
        : null,
      profilePhotoUrl: a.patient.profilePhotoUrl,
      status: a.patient.status,
    })),
    nextUp: nextUp
      ? {
          id: nextUp.id,
          patientName: nextUp.patientName,
          time: nextUp.startsAt.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
          durationMinutes: nextUp.durationMinutes,
          status: nextUp.status,
          notes: nextUp.notes,
        }
      : null,
  });
}
