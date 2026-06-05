import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cancelReminders,
  scheduleReminders,
  statusLabel,
  transitionStatus,
  type AppointmentLifecycleStatus,
} from "@/lib/appointment-lifecycle";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_DB_STATUSES = new Set<AppointmentLifecycleStatus>([
  "requested",
  "reschedule_requested",
  "confirmed",
  "arrived",
  "in_progress",
  "completed",
  "no_show",
  "cancelled",
  "rejected",
  "blocked",
]);

function normalizeStatus(input: string): AppointmentLifecycleStatus | null {
  const dashToUnderscore: Record<string, string> = {
    "in-progress": "in_progress",
    "no-show": "no_show",
    "reschedule-requested": "reschedule_requested",
  };
  const v = dashToUnderscore[input] ?? input;
  return ALLOWED_DB_STATUSES.has(v as AppointmentLifecycleStatus) ? (v as AppointmentLifecycleStatus) : null;
}

interface PatchBody {
  /** Generic lifecycle transition — `confirmed | arrived | in_progress | completed | no_show | cancelled`. */
  status?: string;
  /** Special action that needs more than a status change. */
  action?: "request_reschedule";
  /** For request_reschedule: ISO timestamp of the new slot. */
  proposedStartsAt?: string;
  proposedNote?: string;
  /** Optional notes update (separate from the audit reason). */
  notes?: string | null;
  /** Audit reason — surfaces in the audit ledger row's `reason` column. */
  reason?: string;
}

/**
 * Single appointment owned by the signed-in clinician. Powers the appointment
 * detail page so lifecycle actions read/write the DB rather than localStorage.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Clinician")
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 });
  if (!isDbUid(claims.uid) || !UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  const rows = await prisma.$queryRaw<{
    id: string;
    patientName: string | null;
    patientEmail: string | null;
    startsAt: Date;
    durationMinutes: number;
    status: string;
    room: string | null;
    notes: string | null;
    proposedStartsAt: Date | null;
    proposedNote: string | null;
  }[]>`
    SELECT id, "patientName", "patientEmail", "startsAt", "durationMinutes",
           status::text AS status, room, notes, "proposedStartsAt", "proposedNote"
    FROM appointments
    WHERE id = ${id}::uuid
      AND "clinicianId" = ${claims.uid}::uuid
      AND "deletedAt" IS NULL
    LIMIT 1
  `;
  const a = rows[0];
  if (!a) return NextResponse.json({ ok: false, error: "Appointment not found." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    appointment: {
      id: a.id,
      patientName: a.patientName,
      patientEmail: a.patientEmail,
      startsAt: a.startsAt.toISOString(),
      durationMinutes: a.durationMinutes,
      status: a.status,
      room: a.room,
      mode: a.room === "Telehealth" ? "telehealth" : "in-person",
      notes: a.notes,
      proposedStartsAt: a.proposedStartsAt ? a.proposedStartsAt.toISOString() : null,
      proposedNote: a.proposedNote,
    },
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Clinician")
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 });
  if (!isDbUid(claims.uid))
    return NextResponse.json({ ok: false, error: "Demo session — cannot update DB appointments." }, { status: 400 });
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid appointment id." }, { status: 400 });

  let body: PatchBody;
  try { body = (await req.json()) as PatchBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 }); }

  // Ownership lookup + current state. Raw SQL because the generated client
  // doesn't know the new enum values.
  const owned = await prisma.$queryRaw<{
    id: string;
    organizationId: string;
    status: string;
    startsAt: Date;
    proposedStartsAt: Date | null;
  }[]>`
    SELECT id, "organizationId"::text AS "organizationId",
           status::text AS status, "startsAt", "proposedStartsAt"
    FROM appointments
    WHERE id = ${id}::uuid
      AND "clinicianId" = ${claims.uid}::uuid
      AND "deletedAt" IS NULL
    LIMIT 1
  `;
  const appt = owned[0];
  if (!appt)
    return NextResponse.json({ ok: false, error: "Appointment not found." }, { status: 404 });

  const actorEmail = claims.email ?? null;
  const actor = { uid: claims.uid, email: actorEmail, role: "Clinician" };

  // ── Special action: clinician proposes a new slot for the patient to accept.
  if (body.action === "request_reschedule") {
    const proposedIso = (body.proposedStartsAt ?? "").trim();
    const proposed = new Date(proposedIso);
    if (!proposedIso || Number.isNaN(proposed.getTime()))
      return NextResponse.json({ ok: false, error: "Valid proposedStartsAt (ISO) required." }, { status: 400 });

    // Format as Postgres-friendly "YYYY-MM-DD HH:MM:SS.sss" in UTC, then
    // cast to timestamp so the value lands as a tz-naive UTC timestamp —
    // matches how startsAt is stored and avoids the Prisma-Date → local-tz
    // serialization bleed we saw on Windows dev boxes.
    const proposedSql = proposed.toISOString().replace("T", " ").replace("Z", "");
    await prisma.$executeRaw`
      UPDATE appointments SET
        "proposedStartsAt" = ${proposedSql}::timestamp,
        "proposedNote"     = ${body.proposedNote?.toString().trim() || null},
        "updatedAt"        = NOW()
      WHERE id = ${id}::uuid
    `;
    const r = await transitionStatus({
      appointmentId: id,
      organizationId: appt.organizationId,
      newStatus: "reschedule_requested",
      actor,
      reason: body.reason?.toString().trim() || "Clinician proposed a new slot",
      metadata: { proposedStartsAt: proposed.toISOString(), originalStartsAt: appt.startsAt.toISOString() },
    });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 409 });
    // Cancel any reminders that were keyed to the old slot.
    await cancelReminders(id);
    return after(id);
  }

  // ── Optional notes-only update (no status change).
  if (body.notes !== undefined && body.status === undefined) {
    await prisma.$executeRaw`
      UPDATE appointments SET notes = ${body.notes?.toString().trim() || null}, "updatedAt" = NOW()
      WHERE id = ${id}::uuid
    `;
    return after(id);
  }

  // ── Generic status transition (confirm, arrive, start, complete, no_show, cancel).
  if (body.status !== undefined) {
    const nextStatus = normalizeStatus(body.status);
    if (!nextStatus)
      return NextResponse.json({ ok: false, error: `Unsupported status: ${body.status}` }, { status: 400 });

    // Optional notes patch alongside the status change.
    if (body.notes !== undefined) {
      await prisma.$executeRaw`
        UPDATE appointments SET notes = ${body.notes?.toString().trim() || null}, "updatedAt" = NOW()
        WHERE id = ${id}::uuid
      `;
    }

    const r = await transitionStatus({
      appointmentId: id,
      organizationId: appt.organizationId,
      newStatus: nextStatus,
      actor,
      reason: body.reason?.toString().trim() || `Clinician marked ${statusLabel(nextStatus)}`,
    });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 409 });

    // Side effects per terminal status:
    if (nextStatus === "confirmed") {
      await scheduleReminders({ appointmentId: id, organizationId: appt.organizationId, startsAt: appt.startsAt });
    } else if (nextStatus === "cancelled" || nextStatus === "no_show" || nextStatus === "rejected") {
      await cancelReminders(id);
    }
    return after(id);
  }

  return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
}

async function after(id: string): Promise<NextResponse> {
  const rows = await prisma.$queryRaw<{
    id: string; status: string; startsAt: Date; notes: string | null;
    proposedStartsAt: Date | null; proposedNote: string | null;
  }[]>`
    SELECT id, status::text AS status, "startsAt", notes,
           "proposedStartsAt", "proposedNote"
    FROM appointments WHERE id = ${id}::uuid LIMIT 1
  `;
  const r = rows[0];
  return NextResponse.json({
    ok: true,
    persisted: true,
    appointment: {
      id: r.id,
      status: r.status,
      startsAt: r.startsAt.toISOString(),
      notes: r.notes,
      proposedStartsAt: r.proposedStartsAt ? r.proposedStartsAt.toISOString() : null,
      proposedNote: r.proposedNote,
    },
  });
}
