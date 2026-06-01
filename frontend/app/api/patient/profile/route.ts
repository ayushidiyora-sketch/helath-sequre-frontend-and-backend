import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { RoleKind } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function shape(me: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  profilePhotoUrl: string | null;
  createdAt: Date;
  mfaEnrolledAt: Date | null;
  mfaRequired: boolean;
  organization: { name: string } | null;
}) {
  return {
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
    enrolledAt: me.createdAt.toISOString(),
    mrn: `CG-${me.createdAt.getUTCFullYear()}-${me.id.slice(0, 4).toUpperCase()}`,
  };
}

async function guard(): Promise<
  | { error: NextResponse; uid?: never }
  | { error?: never; uid: string }
> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Patient")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 }) };
  return { uid: claims.uid };
}

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  const me = await prisma.user.findUnique({
    where: { id: g.uid },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      gender: true,
      dateOfBirth: true,
      profilePhotoUrl: true,
      createdAt: true,
      mfaEnrolledAt: true,
      mfaRequired: true,
      roleKind: true,
      organization: { select: { name: true } },
    },
  });
  if (!me || me.roleKind !== RoleKind.patient)
    return NextResponse.json({ ok: false, error: "Patient not found" }, { status: 404 });

  const careTeam = await prisma.patientAssignment.findMany({
    where: { patientId: g.uid, endedAt: null },
    orderBy: { startedAt: "desc" },
    include: {
      clinician: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          designation: true,
          department: true,
          profilePhotoUrl: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    profile: shape(me),
    careTeam: careTeam.map((c) => ({
      assignmentId: c.id,
      role: c.role,
      startedAt: c.startedAt.toISOString(),
      clinician: {
        id: c.clinician.id,
        name: `Dr. ${c.clinician.firstName} ${c.clinician.lastName}`.trim(),
        initials: ((c.clinician.firstName[0] ?? "") + (c.clinician.lastName[0] ?? "")).toUpperCase(),
        designation: c.clinician.designation,
        department: c.clinician.department,
        profilePhotoUrl: c.clinician.profilePhotoUrl,
      },
    })),
  });
}

interface PatchBody {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  profilePhotoUrl?: string | null;
}

export async function PATCH(req: Request) {
  const g = await guard();
  if (g.error) return g.error;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.firstName === "string") {
    const v = body.firstName.trim();
    if (!v) return NextResponse.json({ ok: false, error: "First name is required." }, { status: 400 });
    data.firstName = v;
  }
  if (typeof body.lastName === "string") {
    const v = body.lastName.trim();
    if (!v) return NextResponse.json({ ok: false, error: "Last name is required." }, { status: 400 });
    data.lastName = v;
  }
  if (body.phone !== undefined) {
    const v = body.phone?.trim();
    data.phone = v ? v : null;
  }
  if (body.dateOfBirth !== undefined) {
    const v = body.dateOfBirth?.trim();
    if (!v) {
      data.dateOfBirth = null;
    } else {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ ok: false, error: "Invalid date of birth." }, { status: 400 });
      }
      data.dateOfBirth = d;
    }
  }
  if (body.gender !== undefined) {
    const v = body.gender?.trim();
    data.gender = v ? v : null;
  }
  if (body.profilePhotoUrl !== undefined) {
    const v = body.profilePhotoUrl?.trim();
    data.profilePhotoUrl = v ? v : null;
  }

  const me = await prisma.user.update({
    where: { id: g.uid },
    data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      gender: true,
      dateOfBirth: true,
      profilePhotoUrl: true,
      createdAt: true,
      mfaEnrolledAt: true,
      mfaRequired: true,
      organization: { select: { name: true } },
    },
  });

  return NextResponse.json({ ok: true, profile: shape(me) });
}
