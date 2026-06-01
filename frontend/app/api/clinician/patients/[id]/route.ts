import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--;
  return years;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Clinician")
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 });
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid patient id." }, { status: 400 });

  const assignment = await prisma.patientAssignment.findFirst({
    where: { patientId: id, clinicianId: claims.uid, endedAt: null },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          gender: true,
          dateOfBirth: true,
          profilePhotoUrl: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          mfaEnrolledAt: true,
          mfaRequired: true,
        },
      },
    },
  });

  if (!assignment) {
    return NextResponse.json(
      { ok: false, error: "Patient not on your panel." },
      { status: 404 },
    );
  }

  const p = assignment.patient;
  const age = ageFromDob(p.dateOfBirth);

  return NextResponse.json({
    ok: true,
    patient: {
      id: p.id,
      assignmentId: assignment.id,
      role: assignment.role,
      assignmentNotes: assignment.notes,
      startedAt: assignment.startedAt.toISOString(),
      name: `${p.firstName} ${p.lastName}`.trim(),
      firstName: p.firstName,
      lastName: p.lastName,
      initials: ((p.firstName[0] ?? "") + (p.lastName[0] ?? "")).toUpperCase(),
      email: p.email,
      phone: p.phone,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
      age,
      sex: p.gender === "Male" ? "M" : p.gender === "Female" ? "F" : "—",
      profilePhotoUrl: p.profilePhotoUrl,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      lastLoginAt: p.lastLoginAt ? p.lastLoginAt.toISOString() : null,
      mfaEnrolled: !!p.mfaEnrolledAt,
      mfaRequired: p.mfaRequired,
      mrn: `CG-${assignment.startedAt.getUTCFullYear()}-${id.slice(0, 4).toUpperCase()}`,
    },
  });
}
