import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AppointmentStatus, RoleKind } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface PostBody {
  clinicianId?: string;
  date?: string;         // "YYYY-MM-DD"
  time?: string;         // "9:30 AM" / "2:00 PM"
  durationMinutes?: number;
  mode?: "in-person" | "telehealth";
  reason?: string;
  notes?: string;
}

/** Parse "9:30 AM" or "13:30" into minutes since midnight. */
function parseTime12(label: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(label.trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Patient appointment booking. Validates the clinician + slot, then writes an
 * `Appointment` row tagged with the patient's name + email so it shows up on
 * the clinician's schedule and on the patient's appointment list.
 */
export async function POST(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const clinicianId = body.clinicianId?.trim() ?? "";
  if (!UUID_RE.test(clinicianId))
    return NextResponse.json({ ok: false, error: "Invalid clinician id." }, { status: 400 });

  const date = body.date?.trim() ?? "";
  if (!DATE_RE.test(date))
    return NextResponse.json({ ok: false, error: "Invalid date (YYYY-MM-DD)." }, { status: 400 });

  const minutes = body.time ? parseTime12(body.time) : null;
  if (minutes === null)
    return NextResponse.json({ ok: false, error: "Invalid time." }, { status: 400 });

  const [y, m, d] = date.split("-").map(Number);
  // Construct as LOCAL time so "9:30 AM" on the client's calendar matches the
  // clinician's local schedule. Postgres stores it as a timestamp.
  const startsAt = new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (Number.isNaN(startsAt.getTime()))
    return NextResponse.json({ ok: false, error: "Could not parse start time." }, { status: 400 });

  const durationMinutes = Number.isFinite(body.durationMinutes) ? Number(body.durationMinutes) : 15;
  if (durationMinutes < 5 || durationMinutes > 240)
    return NextResponse.json({ ok: false, error: "Duration must be 5–240 minutes." }, { status: 400 });

  // Lookup clinician → confirm role + grab their organizationId (appointments
  // require an org). Patient self-registered with no org still gets to book —
  // the appointment lives under the clinician's tenant.
  const clinician = await prisma.user.findUnique({
    where: { id: clinicianId },
    select: { id: true, roleKind: true, deletedAt: true, organizationId: true, firstName: true, lastName: true },
  });
  if (!clinician || clinician.deletedAt || clinician.roleKind !== RoleKind.clinician)
    return NextResponse.json({ ok: false, error: "Clinician not found." }, { status: 404 });
  if (!clinician.organizationId)
    return NextResponse.json({ ok: false, error: "Clinician has no tenant." }, { status: 400 });

  // Patient identity from the session JWT.
  const me = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!me)
    return NextResponse.json({ ok: false, error: "Patient not found." }, { status: 404 });

  // Reject double-booking the same exact slot for this clinician.
  const conflict = await prisma.appointment.findFirst({
    where: {
      clinicianId,
      startsAt,
      deletedAt: null,
      status: { notIn: [AppointmentStatus.cancelled, AppointmentStatus.no_show] },
    },
    select: { id: true },
  });
  if (conflict)
    return NextResponse.json(
      { ok: false, error: "That slot was just taken. Please pick a different time." },
      { status: 409 },
    );

  const notes = [body.reason?.trim(), body.notes?.trim()].filter(Boolean).join(" — ") || null;

  const created = await prisma.appointment.create({
    data: {
      organizationId: clinician.organizationId,
      clinicianId,
      patientName: `${me.firstName} ${me.lastName}`.trim() || me.email,
      patientEmail: me.email,
      startsAt,
      durationMinutes,
      status: AppointmentStatus.confirmed,
      room: body.mode === "telehealth" ? "Telehealth" : null,
      notes,
    },
    select: {
      id: true,
      startsAt: true,
      durationMinutes: true,
      status: true,
      room: true,
      notes: true,
    },
  });

  // Auto-establish the care relationship so the patient appears on the
  // clinician's Patient panel. Skipped when an active assignment already
  // exists (e.g. Org Admin pre-assigned the patient). The "self-booked" role
  // tag lets Org Admin distinguish patient-initiated assignments from ones
  // they made manually.
  const existingAssignment = await prisma.patientAssignment.findFirst({
    where: { patientId: claims.uid, clinicianId, endedAt: null },
    select: { id: true },
  });
  if (!existingAssignment) {
    await prisma.patientAssignment.create({
      data: {
        patientId: claims.uid,
        clinicianId,
        role: "self-booked",
        notes: notes ?? "Auto-created on first appointment booking by the patient.",
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      appointment: {
        id: created.id,
        startsAt: created.startsAt.toISOString(),
        durationMinutes: created.durationMinutes,
        status: created.status,
        room: created.room,
        notes: created.notes,
        clinicianName: `Dr. ${clinician.firstName} ${clinician.lastName}`.trim(),
      },
    },
    { status: 201 },
  );
}
