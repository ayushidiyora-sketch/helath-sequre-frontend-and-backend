import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AppointmentStatus } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lifecycle states the clinician can flip an appointment into from the
 * patient-chart EncounterCard. Anything else (e.g. UI-only "arrived" /
 * "in-progress") is treated as no-op on the DB side — the client toasts and
 * keeps a local hint.
 */
const PERSISTED_STATUSES: Record<string, AppointmentStatus> = {
  confirmed:   AppointmentStatus.confirmed,
  completed:   AppointmentStatus.completed,
  "no-show":   AppointmentStatus.no_show,
  no_show:     AppointmentStatus.no_show,
  cancelled:   AppointmentStatus.cancelled,
  blocked:     AppointmentStatus.blocked,
};

interface PatchBody {
  status?: string;
  notes?: string | null;
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
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  // Ownership check — clinician can only mutate their own appointments.
  const existing = await prisma.appointment.findFirst({
    where: { id, clinicianId: claims.uid, deletedAt: null },
    select: { id: true },
  });
  if (!existing)
    return NextResponse.json({ ok: false, error: "Appointment not found." }, { status: 404 });

  const data: { status?: AppointmentStatus; notes?: string | null } = {};
  if (body.status !== undefined) {
    const mapped = PERSISTED_STATUSES[body.status];
    if (!mapped) {
      // UI-only states like "arrived" / "in-progress" — no DB change, but
      // return ok so the front-end can update its local state.
      return NextResponse.json({ ok: true, persisted: false });
    }
    data.status = mapped;
  }
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (Object.keys(data).length === 0)
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });

  const updated = await prisma.appointment.update({
    where: { id },
    data,
    select: { id: true, status: true, startsAt: true, notes: true },
  });
  return NextResponse.json({
    ok: true,
    persisted: true,
    appointment: {
      id: updated.id,
      status: updated.status,
      startsAt: updated.startsAt.toISOString(),
      notes: updated.notes,
    },
  });
}
