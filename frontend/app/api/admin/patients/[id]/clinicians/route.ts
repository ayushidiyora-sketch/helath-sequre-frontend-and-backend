import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { RoleKind, UserStatus } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard(): Promise<
  | { error: NextResponse; orgId?: never }
  | { error?: never; orgId: string }
> {
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

async function ensurePatientVisible(orgId: string, patientId: string) {
  if (!UUID_RE.test(patientId)) return null;
  const p = await prisma.user.findUnique({
    where: { id: patientId },
    select: { id: true, organizationId: true, deletedAt: true, roleKind: true },
  });
  if (!p || p.deletedAt || p.roleKind !== RoleKind.patient) return null;
  if (p.organizationId !== null && p.organizationId !== orgId) return null;
  return p;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guard();
  if (g.error) return g.error;
  const patient = await ensurePatientVisible(g.orgId, id);
  if (!patient) return NextResponse.json({ ok: false, error: "Patient not found." }, { status: 404 });

  const rows = await prisma.patientAssignment.findMany({
    where: { patientId: id, endedAt: null },
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
          status: true,
        },
      },
    },
  });

  // Pool of clinicians available for assignment in this tenant.
  const clinicians = await prisma.user.findMany({
    where: {
      organizationId: g.orgId,
      roleKind: RoleKind.clinician,
      deletedAt: null,
      status: { in: [UserStatus.active, UserStatus.invited] },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      designation: true,
      department: true,
      profilePhotoUrl: true,
    },
  });

  return NextResponse.json({
    ok: true,
    assignments: rows.map((r) => ({
      id: r.id,
      role: r.role,
      notes: r.notes,
      startedAt: r.startedAt.toISOString(),
      clinician: {
        id: r.clinician.id,
        name: `Dr. ${r.clinician.firstName} ${r.clinician.lastName}`.trim(),
        firstName: r.clinician.firstName,
        lastName: r.clinician.lastName,
        email: r.clinician.email,
        designation: r.clinician.designation,
        department: r.clinician.department,
        profilePhotoUrl: r.clinician.profilePhotoUrl,
        status: r.clinician.status,
      },
    })),
    availableClinicians: clinicians.map((c) => ({
      id: c.id,
      name: `Dr. ${c.firstName} ${c.lastName}`.trim(),
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      designation: c.designation,
      department: c.department,
      profilePhotoUrl: c.profilePhotoUrl,
    })),
  });
}

interface CreateBody {
  clinicianId?: string;
  role?: string;
  notes?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guard();
  if (g.error) return g.error;
  const patient = await ensurePatientVisible(g.orgId, id);
  if (!patient) return NextResponse.json({ ok: false, error: "Patient not found." }, { status: 404 });

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const clinicianId = body.clinicianId?.trim() ?? "";
  if (!UUID_RE.test(clinicianId)) {
    return NextResponse.json({ ok: false, error: "Select a clinician to assign." }, { status: 400 });
  }

  const clinician = await prisma.user.findUnique({
    where: { id: clinicianId },
    select: { id: true, organizationId: true, roleKind: true, deletedAt: true, firstName: true, lastName: true },
  });
  if (
    !clinician ||
    clinician.deletedAt ||
    clinician.roleKind !== RoleKind.clinician ||
    clinician.organizationId !== g.orgId
  ) {
    return NextResponse.json({ ok: false, error: "Clinician not found in this tenant." }, { status: 404 });
  }

  // Reject duplicate active panel relationship.
  const dup = await prisma.patientAssignment.findFirst({
    where: { patientId: id, clinicianId, endedAt: null },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json(
      { ok: false, error: `Dr. ${clinician.firstName} ${clinician.lastName} is already assigned to this patient.` },
      { status: 409 },
    );
  }

  const role = body.role?.trim() || null;
  const notes = body.notes?.trim() || null;

  const created = await prisma.patientAssignment.create({
    data: {
      patientId: id,
      clinicianId,
      role: role ?? undefined,
      notes: notes ?? undefined,
    },
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
          status: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      ok: true,
      assignment: {
        id: created.id,
        role: created.role,
        notes: created.notes,
        startedAt: created.startedAt.toISOString(),
        clinician: {
          id: created.clinician.id,
          name: `Dr. ${created.clinician.firstName} ${created.clinician.lastName}`.trim(),
          firstName: created.clinician.firstName,
          lastName: created.clinician.lastName,
          email: created.clinician.email,
          designation: created.clinician.designation,
          department: created.clinician.department,
          profilePhotoUrl: created.clinician.profilePhotoUrl,
          status: created.clinician.status,
        },
      },
    },
    { status: 201 },
  );
}
