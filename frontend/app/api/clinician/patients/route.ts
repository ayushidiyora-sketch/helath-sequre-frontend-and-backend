import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--;
  return years;
}

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Clinician")
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 });

  const assignments = await prisma.patientAssignment.findMany({
    where: { clinicianId: claims.uid, endedAt: null },
    orderBy: { startedAt: "desc" },
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
          appointments: {
            where: { clinicianId: claims.uid, deletedAt: null },
            orderBy: { startsAt: "desc" },
            take: 1,
            select: { startsAt: true, status: true, notes: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    patients: assignments.map((a, i) => {
      const p = a.patient;
      const age = ageFromDob(p.dateOfBirth);
      const last = p.appointments[0];
      return {
        id: p.id,
        assignmentId: a.id,
        role: a.role,
        notes: a.notes,
        startedAt: a.startedAt.toISOString(),
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
        mfaEnrolled: !!p.mfaEnrolledAt,
        mrn: `CG-${a.startedAt.getUTCFullYear()}-${String(i + 1).padStart(4, "0")}`,
        lastContact: last
          ? {
              date: last.startsAt.toISOString().slice(0, 10),
              label: `${last.startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${last.notes ?? "Visit"}`,
            }
          : null,
      };
    }),
  });
}
