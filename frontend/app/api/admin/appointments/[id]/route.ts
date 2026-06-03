import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AppointmentStatus, Prisma, RoleKind } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface PatchBody {
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

async function requireOrgAdminFor(appointmentId: string) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Org Admin")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Org Admin only." }, { status: 403 }) };
  if (!claims.org)
    return { error: NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 }) };
  const org = await prisma.organization.findUnique({ where: { slug: claims.org }, select: { id: true } });
  if (!org) return { error: NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 }) };

  const target = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId: org.id, deletedAt: null },
    select: { id: true },
  });
  if (!target) {
    return { error: NextResponse.json({ ok: false, error: "Appointment not found." }, { status: 404 }) };
  }
  return { orgId: org.id, appointmentId: target.id };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireOrgAdminFor(id);
  if ("error" in guard && guard.error) return guard.error;
  const orgId = (guard as { orgId: string }).orgId;
  const appointmentId = (guard as { appointmentId: string }).appointmentId;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const data: Prisma.AppointmentUpdateInput = {};

  if (body.clinicianId !== undefined) {
    const c = await prisma.user.findFirst({
      where: {
        id: body.clinicianId,
        organizationId: orgId,
        deletedAt: null,
        roleKind: RoleKind.clinician,
      },
      select: { id: true },
    });
    if (!c) {
      return NextResponse.json({ ok: false, error: "Clinician not found in this tenant." }, { status: 400 });
    }
    data.clinician = { connect: { id: c.id } };
  }
  if (body.patientName !== undefined) data.patientName = body.patientName?.trim() || null;
  if (body.patientEmail !== undefined) data.patientEmail = body.patientEmail?.trim() || null;
  if (body.startsAt !== undefined) {
    const t = new Date(body.startsAt);
    if (Number.isNaN(t.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid start time." }, { status: 400 });
    }
    data.startsAt = t;
  }
  if (body.durationMinutes !== undefined) {
    if (!Number.isInteger(body.durationMinutes) || body.durationMinutes < 5 || body.durationMinutes > 240) {
      return NextResponse.json(
        { ok: false, error: "Duration must be between 5 and 240 minutes." },
        { status: 400 },
      );
    }
    data.durationMinutes = body.durationMinutes;
  }
  if (body.room !== undefined) data.room = body.room?.trim() || null;
  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.includes(body.status as AppointmentStatus)) {
      return NextResponse.json(
        { ok: false, error: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    data.status = body.status as AppointmentStatus;
  }
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  try {
    // Write via prisma.update (known enum value coming in), then read back
    // via raw SQL so we tolerate rows whose CURRENT status is one of the new
    // enum values the generated client doesn't know about (arrived /
    // in_progress).
    await prisma.appointment.update({
      where: { id: appointmentId },
      data,
      select: { id: true },
    });
    const rows = await prisma.$queryRaw<{
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
    }[]>`
      SELECT a.id, a."clinicianId",
             u."firstName" AS "clinicianFirstName",
             u."lastName"  AS "clinicianLastName",
             a."patientName", a."patientEmail", a."startsAt",
             a."durationMinutes", a.room, a.status::text AS status, a.notes
      FROM appointments a
      JOIN users u ON u.id = a."clinicianId"
      WHERE a.id = ${appointmentId}::uuid
      LIMIT 1
    `;
    const updated = rows[0];
    return NextResponse.json({
      ok: true,
      appointment: {
        id: updated.id,
        clinicianId: updated.clinicianId,
        clinicianName: `Dr. ${updated.clinicianFirstName} ${updated.clinicianLastName}`.trim(),
        patientName: updated.patientName,
        patientEmail: updated.patientEmail,
        startsAt: updated.startsAt.toISOString(),
        durationMinutes: updated.durationMinutes,
        room: updated.room,
        status: updated.status,
        notes: updated.notes,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Appointment not found." }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireOrgAdminFor(id);
  if ("error" in guard && guard.error) return guard.error;
  const appointmentId = (guard as { appointmentId: string }).appointmentId;
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { deletedAt: new Date(), status: AppointmentStatus.cancelled },
  });
  return NextResponse.json({ ok: true });
}
