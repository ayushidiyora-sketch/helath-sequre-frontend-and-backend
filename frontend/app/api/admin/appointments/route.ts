import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AppointmentStatus, Prisma, RoleKind } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Guard =
  | { error: NextResponse; orgId?: never }
  | { error?: never; orgId: string };

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
  return { orgId: org.id };
}

interface BookBody {
  clinicianId?: string;
  patientName?: string | null;
  patientEmail?: string | null;
  startsAt?: string;
  durationMinutes?: number;
  room?: string | null;
  status?: string;
  notes?: string | null;
}

const ALLOWED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.confirmed,
  AppointmentStatus.no_show,
  AppointmentStatus.blocked,
  AppointmentStatus.cancelled,
  AppointmentStatus.completed,
];

interface PublicAppointment {
  id: string;
  clinicianId: string;
  clinicianName: string;
  patientName: string | null;
  patientEmail: string | null;
  startsAt: string;
  durationMinutes: number;
  room: string | null;
  status: AppointmentStatus;
  notes: string | null;
}

function shape(a: {
  id: string;
  clinicianId: string;
  clinician: { firstName: string; lastName: string };
  patientName: string | null;
  patientEmail: string | null;
  startsAt: Date;
  durationMinutes: number;
  room: string | null;
  status: AppointmentStatus;
  notes: string | null;
}): PublicAppointment {
  return {
    id: a.id,
    clinicianId: a.clinicianId,
    clinicianName: `Dr. ${a.clinician.firstName} ${a.clinician.lastName}`.trim(),
    patientName: a.patientName,
    patientEmail: a.patientEmail,
    startsAt: a.startsAt.toISOString(),
    durationMinutes: a.durationMinutes,
    room: a.room,
    status: a.status,
    notes: a.notes,
  };
}

/**
 * GET /api/admin/appointments?date=YYYY-MM-DD
 *
 * Lists appointments for the given day (defaults to today in the server's
 * local timezone). Returns the full visible list + per-status counts for
 * the stat cards.
 */
export async function GET(req: Request) {
  const guard = await requireOrgAdmin();
  if (guard.error) return guard.error;

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const target = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(target.getTime())) {
    return NextResponse.json({ ok: false, error: "Invalid date." }, { status: 400 });
  }
  const dayStart = new Date(target);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Raw SQL so we tolerate the new `arrived` / `in_progress` enum values that
  // the generated Prisma client doesn't yet know (Windows DLL lock blocks
  // `prisma generate`).
  interface AdminApptRow {
    id: string;
    clinicianId: string;
    clinicianFirstName: string;
    clinicianLastName: string;
    patientName: string | null;
    patientEmail: string | null;
    startsAt: Date;
    durationMinutes: number;
    room: string | null;
    status: string;
    notes: string | null;
  }
  const rawRows = await prisma.$queryRaw<AdminApptRow[]>`
    SELECT a.id, a."clinicianId",
           u."firstName" AS "clinicianFirstName",
           u."lastName"  AS "clinicianLastName",
           a."patientName", a."patientEmail", a."startsAt",
           a."durationMinutes", a.room, a.status::text AS status, a.notes
    FROM appointments a
    JOIN users u ON u.id = a."clinicianId"
    WHERE a."organizationId" = ${guard.orgId}::uuid
      AND a."deletedAt" IS NULL
      AND a."startsAt" >= ${dayStart}
      AND a."startsAt" <  ${dayEnd}
    ORDER BY a."startsAt" ASC, a."clinicianId" ASC
  `;
  const list = rawRows.map((r) =>
    shape({
      id: r.id,
      clinicianId: r.clinicianId,
      clinician: { firstName: r.clinicianFirstName, lastName: r.clinicianLastName },
      patientName: r.patientName,
      patientEmail: r.patientEmail,
      startsAt: r.startsAt,
      durationMinutes: r.durationMinutes,
      room: r.room,
      status: r.status as AppointmentStatus,
      notes: r.notes,
    }),
  );
  const counts = {
    total: list.length,
    confirmed: list.filter((a) => a.status === "confirmed").length,
    noShows: list.filter((a) => a.status === "no_show").length,
    blocked: list.filter((a) => a.status === "blocked").length,
    cancelled: list.filter((a) => a.status === "cancelled").length,
    completed: list.filter((a) => a.status === "completed").length,
    telehealth: list.filter((a) => (a.room ?? "").toLowerCase() === "telehealth").length,
  };
  return NextResponse.json({
    ok: true,
    date: dayStart.toISOString().slice(0, 10),
    counts,
    appointments: list,
  });
}

export async function POST(req: Request) {
  const guard = await requireOrgAdmin();
  if (guard.error) return guard.error;

  let body: BookBody;
  try {
    body = (await req.json()) as BookBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const clinicianId = body.clinicianId?.trim() ?? "";
  if (!clinicianId) {
    return NextResponse.json({ ok: false, error: "Clinician is required." }, { status: 400 });
  }

  // Make sure the clinician belongs to this tenant and is a clinician.
  const clinician = await prisma.user.findFirst({
    where: {
      id: clinicianId,
      organizationId: guard.orgId,
      deletedAt: null,
      roleKind: RoleKind.clinician,
    },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!clinician) {
    return NextResponse.json({ ok: false, error: "Clinician not found in this tenant." }, { status: 400 });
  }

  const status = (body.status as AppointmentStatus) ?? AppointmentStatus.confirmed;
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { ok: false, error: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  if (!body.startsAt) {
    return NextResponse.json({ ok: false, error: "Start time is required." }, { status: 400 });
  }
  const startsAt = new Date(body.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ ok: false, error: "Invalid start time." }, { status: 400 });
  }

  const duration = body.durationMinutes ?? 30;
  if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
    return NextResponse.json(
      { ok: false, error: "Duration must be between 5 and 240 minutes." },
      { status: 400 },
    );
  }

  // For "blocked" slots, patient fields don't make sense.
  const patientName =
    status === AppointmentStatus.blocked ? null : body.patientName?.trim() || null;
  const patientEmail =
    status === AppointmentStatus.blocked ? null : body.patientEmail?.trim() || null;

  if (status !== AppointmentStatus.blocked && !patientName) {
    return NextResponse.json({ ok: false, error: "Patient name is required." }, { status: 400 });
  }

  const created = await prisma.appointment.create({
    data: {
      organizationId: guard.orgId,
      clinicianId: clinician.id,
      patientName,
      patientEmail,
      startsAt,
      durationMinutes: duration,
      room: body.room?.trim() || null,
      status,
      notes: body.notes?.trim() || null,
    },
    include: { clinician: { select: { id: true, firstName: true, lastName: true } } },
  });

  return NextResponse.json({ ok: true, appointment: shape(created) }, { status: 201 });
}
