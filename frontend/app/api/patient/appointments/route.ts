import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { RoleKind } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/appointment-lifecycle";
import { appBaseUrl, sendActionEmail } from "@/lib/notify";

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
/**
 * Returns the patient's own DB-backed appointments — the chart on
 * /patient/appointments uses this so DB-resident bookings (including those
 * created by the clinician via /api/clinician/appointments) show up alongside
 * any legacy local-store entries. Demo sessions short-circuit to an empty
 * list to avoid hitting Postgres with a non-UUID id.
 */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, appointments: [] });

  // Patient's email is the join key on the appointments table (patientEmail is
  // captured at booking time; we also fall back to patientId match for safety).
  const me = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { email: true },
  });
  if (!me) return NextResponse.json({ ok: true, appointments: [] });

  const rows = await prisma.$queryRaw<{
    id: string;
    startsAt: Date;
    durationMinutes: number;
    status: string;
    room: string | null;
    notes: string | null;
    proposedStartsAt: Date | null;
    proposedNote: string | null;
    clinicianId: string;
    clinicianFirstName: string | null;
    clinicianLastName: string | null;
    clinicianDepartment: string | null;
    clinicianDesignation: string | null;
  }[]>`
    SELECT a.id, a."startsAt", a."durationMinutes", a.status::text AS status,
           a.room, a.notes,
           a."proposedStartsAt", a."proposedNote",
           a."clinicianId",
           u."firstName"   AS "clinicianFirstName",
           u."lastName"    AS "clinicianLastName",
           u.department    AS "clinicianDepartment",
           u.designation   AS "clinicianDesignation"
    FROM appointments a
    JOIN users u ON u.id = a."clinicianId"
    WHERE a."patientEmail" = ${me.email}
      AND a."deletedAt" IS NULL
    ORDER BY a."startsAt" DESC
    LIMIT 200
  `;

  return NextResponse.json({
    ok: true,
    appointments: rows.map((r) => {
      const d = r.startsAt;
      return {
        id: r.id,
        clinicianId: r.clinicianId,
        clinicianName: `Dr. ${[r.clinicianFirstName, r.clinicianLastName].filter(Boolean).join(" ").trim()}`.trim(),
        clinicianDepartment: r.clinicianDepartment ?? r.clinicianDesignation ?? "Care team",
        startsAt: d.toISOString(),
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        durationMinutes: r.durationMinutes,
        room: r.room,
        notes: r.notes,
        proposedStartsAt: r.proposedStartsAt ? r.proposedStartsAt.toISOString() : null,
        proposedNote: r.proposedNote,
        status: r.status,
        mode: r.room === "Telehealth" ? "telehealth" : "in-person",
      };
    }),
  });
}

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
  const startsAt = new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (Number.isNaN(startsAt.getTime()))
    return NextResponse.json({ ok: false, error: "Could not parse start time." }, { status: 400 });
  // Store the UTC instant's wall-clock as a tz-naive literal (e.g. "2026-06-10
  // 11:00:00" for 4:30 PM IST) so it round-trips correctly: every read formats
  // startsAt in local time, which recovers the original slot. Binding the JS
  // Date directly stored the LOCAL wall-clock instead, so reads came back +offset
  // (4:30 PM booked → 10:00 PM shown). Matches the clinician + reschedule paths.
  const startsAtSql = startsAt.toISOString().replace("T", " ").replace("Z", "");

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

  // Reject double-booking the same exact slot for this clinician — raw SQL
  // because the generated client doesn't know the new enum values.
  const conflict = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM appointments
    WHERE "clinicianId" = ${clinicianId}::uuid
      AND "startsAt" = ${startsAtSql}::timestamp
      AND "deletedAt" IS NULL
      AND status NOT IN ('cancelled','no_show')
    LIMIT 1
  `;
  if (conflict[0])
    return NextResponse.json(
      { ok: false, error: "That slot was just taken. Please pick a different time." },
      { status: 409 },
    );

  const notes = [body.reason?.trim(), body.notes?.trim()].filter(Boolean).join(" — ") || null;
  const patientName = `${me.firstName} ${me.lastName}`.trim() || me.email;
  const room = body.mode === "telehealth" ? "Telehealth" : null;

  // Patient-initiated booking lands as `requested` so the clinician has to
  // confirm before it counts as scheduled. Raw SQL because the generated
  // Prisma client doesn't yet know the `requested` enum value.
  const inserted = await prisma.$queryRaw<{
    id: string; startsAt: Date; durationMinutes: number; status: string;
    room: string | null; notes: string | null;
  }[]>`
    INSERT INTO appointments
      (id, "organizationId", "clinicianId", "patientName", "patientEmail",
       "startsAt", "durationMinutes", status, room, notes, "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${clinician.organizationId}::uuid, ${clinicianId}::uuid,
       ${patientName}, ${me.email},
       ${startsAtSql}::timestamp, ${durationMinutes}, 'requested'::"AppointmentStatus",
       ${room}, ${notes}, NOW(), NOW())
    RETURNING id, "startsAt", "durationMinutes", status::text AS status, room, notes
  `;
  const created = inserted[0];

  // First audit entry — records who booked the request.
  await writeAudit({
    appointmentId: created.id,
    organizationId: clinician.organizationId,
    previousStatus: null,
    newStatus: "requested",
    actor: { uid: claims.uid, email: me.email, role: "Patient" },
    reason: "Patient-initiated booking",
    metadata: { startsAt: startsAt.toISOString(), durationMinutes, mode: body.mode ?? "in-person" },
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

interface PatchBody {
  action?: "accept_reschedule" | "decline_reschedule" | "patient_reschedule" | "cancel";
  appointmentId?: string;
  reason?: string;
  /** ISO timestamp of the slot the patient wants to move to (patient_reschedule only). */
  proposedStartsAt?: string;
}

/**
 * Patient-side appointment actions:
 *  - accept_reschedule: clinician proposed a new slot; patient confirms it,
 *    appointments.startsAt is moved to proposedStartsAt + status flips to confirmed.
 *  - cancel: patient cancels their own appointment (requested or confirmed).
 */
export async function PATCH(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });
  if (!isDbUid(claims.uid))
    return NextResponse.json({ ok: false, error: "Demo session." }, { status: 400 });

  let body: PatchBody;
  try { body = await req.json() as PatchBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const id = (body.appointmentId ?? "").trim();
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid appointmentId." }, { status: 400 });

  // Ownership + lookup via raw SQL (handles new enum values).
  const rows = await prisma.$queryRaw<{
    id: string; status: string; organizationId: string;
    patientEmail: string | null; patientName: string | null; startsAt: Date; proposedStartsAt: Date | null;
    clinicianEmail: string | null; clinicianFirst: string | null; clinicianLast: string | null;
  }[]>`
    SELECT a.id, a.status::text AS status, a."organizationId"::text AS "organizationId",
           a."patientEmail", a."patientName", a."startsAt", a."proposedStartsAt",
           c.email AS "clinicianEmail", c."firstName" AS "clinicianFirst", c."lastName" AS "clinicianLast"
    FROM appointments a
    LEFT JOIN users c ON c.id = a."clinicianId"
    WHERE a.id = ${id}::uuid AND a."deletedAt" IS NULL LIMIT 1
  `;
  const appt = rows[0];
  if (!appt) return NextResponse.json({ ok: false, error: "Appointment not found." }, { status: 404 });

  const me = await prisma.user.findUnique({ where: { id: claims.uid }, select: { email: true } });
  if (!me || appt.patientEmail?.toLowerCase() !== me.email.toLowerCase())
    return NextResponse.json({ ok: false, error: "Not your appointment." }, { status: 403 });

  const { transitionStatus, scheduleReminders, cancelReminders } = await import("@/lib/appointment-lifecycle");

  if (body.action === "accept_reschedule") {
    if (appt.status !== "reschedule_requested" || !appt.proposedStartsAt)
      return NextResponse.json({ ok: false, error: "No active reschedule proposal on this appointment." }, { status: 409 });
    await prisma.$executeRaw`
      UPDATE appointments SET
        "startsAt"          = "proposedStartsAt",
        "proposedStartsAt"  = NULL,
        "proposedNote"      = NULL,
        "updatedAt"         = NOW()
      WHERE id = ${id}::uuid
    `;
    const result = await transitionStatus({
      appointmentId: id,
      organizationId: appt.organizationId,
      newStatus: "confirmed",
      actor: { uid: claims.uid, email: me.email, role: "Patient" },
      reason: "Patient accepted reschedule",
      metadata: { acceptedStartsAt: appt.proposedStartsAt.toISOString() },
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    await scheduleReminders({ appointmentId: id, organizationId: appt.organizationId, startsAt: appt.proposedStartsAt });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "decline_reschedule") {
    if (appt.status !== "reschedule_requested")
      return NextResponse.json({ ok: false, error: "No active reschedule proposal on this appointment." }, { status: 409 });
    // Drop the proposal, leave the original slot intact, and move the
    // appointment back to `requested` so the clinician knows to handle it
    // again (the patient implicitly rejected the suggested slot).
    await prisma.$executeRaw`
      UPDATE appointments SET
        "proposedStartsAt"  = NULL,
        "proposedNote"      = NULL,
        "updatedAt"         = NOW()
      WHERE id = ${id}::uuid
    `;
    const result = await transitionStatus({
      appointmentId: id,
      organizationId: appt.organizationId,
      newStatus: "requested",
      actor: { uid: claims.uid, email: me.email, role: "Patient" },
      reason: body.reason?.toString().trim() || "Patient declined the proposed reschedule",
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "patient_reschedule") {
    // Only allowed before the clinician has done anything irreversible —
    // requested, reschedule_requested, and confirmed are all editable by the
    // patient. Once the lifecycle hits arrived/in_progress/completed/no_show
    // the patient can't change the time anymore (they'd cancel + rebook).
    if (
      appt.status !== "requested" &&
      appt.status !== "reschedule_requested" &&
      appt.status !== "confirmed"
    ) {
      return NextResponse.json(
        { ok: false, error: `Cannot reschedule a ${appt.status} appointment.` },
        { status: 409 },
      );
    }
    const proposedIso = (body.proposedStartsAt ?? "").trim();
    const newStart = new Date(proposedIso);
    if (!proposedIso || Number.isNaN(newStart.getTime()))
      return NextResponse.json({ ok: false, error: "Valid proposedStartsAt (ISO) required." }, { status: 400 });
    if (newStart.getTime() <= Date.now())
      return NextResponse.json({ ok: false, error: "Pick a slot in the future." }, { status: 400 });

    // Move the appointment to the new time AND flip status back to requested
    // so the clinician re-confirms. Pass the timestamp as a tz-naive UTC
    // string + cast so it round-trips without timezone bleed (see clinician
    // route for the same trick).
    const newStartSql = newStart.toISOString().replace("T", " ").replace("Z", "");
    await prisma.$executeRaw`
      UPDATE appointments SET
        "startsAt"          = ${newStartSql}::timestamp,
        "proposedStartsAt"  = NULL,
        "proposedNote"      = ${body.reason?.toString().trim() || null},
        "updatedAt"         = NOW()
      WHERE id = ${id}::uuid
    `;
    const result = await transitionStatus({
      appointmentId: id,
      organizationId: appt.organizationId,
      newStatus: "requested",
      actor: { uid: claims.uid, email: me.email, role: "Patient" },
      reason: body.reason?.toString().trim() || "Patient rescheduled",
      metadata: { newStartsAt: newStart.toISOString() },
      initial: true,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    await cancelReminders(id);
    // Notify the clinician (Schedule category) — best-effort.
    if (appt.clinicianEmail) {
      const when = newStart.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      await sendActionEmail({
        orgId: appt.organizationId,
        to: appt.clinicianEmail,
        categoryKey: "appointments",
        slug: "appointment-rescheduled-clinician",
        vars: { action_url: `${appBaseUrl()}/clinician/schedule` },
        fallbackSubject: `${appt.patientName ?? "A patient"} rescheduled their appointment`,
        fallbackText:
          `${appt.patientName ?? "A patient"} moved their appointment to ${when} and it needs your confirmation.\n\n` +
          `Review your schedule: ${appBaseUrl()}/clinician/schedule\n\n— HealthSecure`,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "cancel") {
    if (appt.status === "completed" || appt.status === "cancelled" || appt.status === "no_show")
      return NextResponse.json({ ok: false, error: `Cannot cancel a ${appt.status} appointment.` }, { status: 409 });
    const result = await transitionStatus({
      appointmentId: id,
      organizationId: appt.organizationId,
      newStatus: "cancelled",
      actor: { uid: claims.uid, email: me.email, role: "Patient" },
      reason: body.reason?.toString().trim() || "Patient cancellation",
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    await cancelReminders(id);
    // Notify the clinician their slot opened up (Schedule category) — best-effort.
    if (appt.clinicianEmail) {
      const when = appt.startsAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      await sendActionEmail({
        orgId: appt.organizationId,
        to: appt.clinicianEmail,
        categoryKey: "appointments",
        slug: "appointment-cancelled-clinician",
        vars: { action_url: `${appBaseUrl()}/clinician/schedule` },
        fallbackSubject: `${appt.patientName ?? "A patient"} cancelled their appointment`,
        fallbackText:
          `${appt.patientName ?? "A patient"} cancelled their appointment (${when}); the slot is now free.\n\n` +
          `Review your schedule: ${appBaseUrl()}/clinician/schedule\n\n— HealthSecure`,
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
