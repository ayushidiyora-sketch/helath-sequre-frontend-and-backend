import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AppointmentStatus, RoleKind } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the signed-in clinician's appointments. Optional `?from` and `?to`
 * (YYYY-MM-DD, inclusive bounds in local time) narrow the window — used by the
 * Schedule Day tab (from=to=today) and the Week tab (from=Mon, to=Sun).
 */
export async function GET(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Clinician")
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 });
  // Demo-user session — return empty list instead of hitting Postgres with a
  // non-UUID id.
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, appointments: [] });

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  if (fromStr) {
    if (!DATE_RE.test(fromStr))
      return NextResponse.json({ ok: false, error: "Invalid from (YYYY-MM-DD)." }, { status: 400 });
    const [y, m, d] = fromStr.split("-").map(Number);
    fromDate = new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  if (toStr) {
    if (!DATE_RE.test(toStr))
      return NextResponse.json({ ok: false, error: "Invalid to (YYYY-MM-DD)." }, { status: 400 });
    const [y, m, d] = toStr.split("-").map(Number);
    toDate = new Date(y, m - 1, d, 23, 59, 59, 999);
  }

  const rows = await prisma.appointment.findMany({
    where: {
      clinicianId: claims.uid,
      deletedAt: null,
      ...(fromDate || toDate
        ? {
            startsAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
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
  });

  return NextResponse.json({
    ok: true,
    appointments: rows.map((a) => {
      const d = a.startsAt;
      return {
        id: a.id,
        patientName: a.patientName,
        patientEmail: a.patientEmail,
        startsAt: d.toISOString(),
        // Convenient pre-formatted fields so the schedule UI doesn't have to
        // re-parse — store-derived `date` (YYYY-MM-DD, local) and `time`
        // ("9:30 AM") match the patient-store appointment shape too.
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        durationMinutes: a.durationMinutes,
        room: a.room,
        status: a.status,
        mode: a.room === "Telehealth" ? "telehealth" : "in-person",
        notes: a.notes,
        completed: a.status === AppointmentStatus.completed,
      };
    }),
  });
}

interface PostBody {
  patientId?: string;
  date?: string;       // YYYY-MM-DD
  time?: string;       // 24h "HH:MM"
  durationMinutes?: number;
  mode?: "in-person" | "telehealth";
  notes?: string;
}

/**
 * Clinician creates an appointment for one of their assigned patients. Used
 * from the patient chart's "Add appointment" action — no patient interaction
 * required.
 */
export async function POST(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Clinician")
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 });
  if (!isDbUid(claims.uid))
    return NextResponse.json({ ok: false, error: "Demo session — appointments require a real account." }, { status: 400 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const patientId = body.patientId?.trim() ?? "";
  if (!UUID_RE.test(patientId))
    return NextResponse.json({ ok: false, error: "Invalid patientId." }, { status: 400 });
  const dateStr = body.date?.trim() ?? "";
  if (!DATE_RE.test(dateStr))
    return NextResponse.json({ ok: false, error: "Invalid date (YYYY-MM-DD)." }, { status: 400 });
  const timeStr = body.time?.trim() ?? "";
  const tMatch = TIME_RE.exec(timeStr);
  if (!tMatch)
    return NextResponse.json({ ok: false, error: "Invalid time (HH:MM 24h)." }, { status: 400 });
  const [y, mo, d] = dateStr.split("-").map(Number);
  const startsAt = new Date(y, mo - 1, d, Number(tMatch[1]), Number(tMatch[2]), 0, 0);
  if (Number.isNaN(startsAt.getTime()))
    return NextResponse.json({ ok: false, error: "Could not parse start time." }, { status: 400 });
  const durationMinutes = Number.isFinite(body.durationMinutes) ? Number(body.durationMinutes) : 30;
  if (durationMinutes < 5 || durationMinutes > 240)
    return NextResponse.json({ ok: false, error: "Duration must be 5–240 minutes." }, { status: 400 });

  // Confirm the patient is on this clinician's panel.
  const assigned = await prisma.patientAssignment.findFirst({
    where: { clinicianId: claims.uid, patientId, endedAt: null },
    select: { id: true },
  });
  if (!assigned)
    return NextResponse.json({ ok: false, error: "Patient is not on your panel." }, { status: 403 });

  const me = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { organizationId: true },
  });
  if (!me?.organizationId)
    return NextResponse.json({ ok: false, error: "Clinician has no tenant." }, { status: 400 });

  const patient = await prisma.user.findUnique({
    where: { id: patientId },
    select: { firstName: true, lastName: true, email: true, roleKind: true, deletedAt: true },
  });
  if (!patient || patient.deletedAt || patient.roleKind !== RoleKind.patient)
    return NextResponse.json({ ok: false, error: "Patient not found." }, { status: 404 });

  // Reject double-booking the same slot.
  const conflict = await prisma.appointment.findFirst({
    where: {
      clinicianId: claims.uid,
      startsAt,
      deletedAt: null,
      status: { notIn: [AppointmentStatus.cancelled, AppointmentStatus.no_show] },
    },
    select: { id: true },
  });
  if (conflict)
    return NextResponse.json({ ok: false, error: "That slot is already taken." }, { status: 409 });

  const created = await prisma.appointment.create({
    data: {
      organizationId: me.organizationId,
      clinicianId: claims.uid,
      patientName: `${patient.firstName} ${patient.lastName}`.trim() || patient.email,
      patientEmail: patient.email,
      startsAt,
      durationMinutes,
      status: AppointmentStatus.confirmed,
      room: body.mode === "telehealth" ? "Telehealth" : null,
      notes: body.notes?.trim() || null,
    },
    select: { id: true, startsAt: true, durationMinutes: true, status: true },
  });

  return NextResponse.json(
    {
      ok: true,
      appointment: {
        id: created.id,
        startsAt: created.startsAt.toISOString(),
        durationMinutes: created.durationMinutes,
        status: created.status,
      },
    },
    { status: 201 },
  );
}
