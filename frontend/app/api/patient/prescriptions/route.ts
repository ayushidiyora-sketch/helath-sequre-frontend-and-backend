import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface PatientRxRow {
  id: string;
  drugName: string;
  strength: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  refills: number;
  patientInstructions: string | null;
  status: string;
  createdAt: Date;
  finalizedAt: Date | null;
  clinicianId: string;
  clinicianFirstName: string;
  clinicianLastName: string;
  clinicianDesignation: string | null;
  clinicianDepartment: string | null;
  tenantName: string | null;
}

/**
 * Returns finalized prescriptions for the signed-in patient. Drafts are
 * deliberately excluded — the patient should not see in-progress prescriptions
 * until the clinician hits "Finalize & lock".
 *
 * Uses $queryRaw because the runtime Prisma client cache may not yet know
 * about the `Prescription` model (DLL locked by dev server) — matches the
 * pattern in /api/clinician/prescriptions.
 */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });

  const rows = await prisma.$queryRaw<PatientRxRow[]>`
    SELECT
      p.id,
      p."drugName",
      p.strength,
      p.route,
      p.frequency,
      p.duration,
      p.refills,
      p."patientInstructions",
      p.status,
      p."createdAt",
      p."finalizedAt",
      p."clinicianId",
      u."firstName"   AS "clinicianFirstName",
      u."lastName"    AS "clinicianLastName",
      u.designation   AS "clinicianDesignation",
      u.department    AS "clinicianDepartment",
      o.name          AS "tenantName"
    FROM prescriptions p
    JOIN users u ON u.id = p."clinicianId"
    LEFT JOIN organizations o ON o.id = p."organizationId"
    WHERE p."patientId" = ${claims.uid}::uuid
      AND p."deletedAt" IS NULL
      AND p.status = 'finalized'
    ORDER BY p."finalizedAt" DESC NULLS LAST, p."createdAt" DESC
  `;

  return NextResponse.json({
    ok: true,
    prescriptions: rows.map((r) => ({
      id: r.id,
      drug: r.drugName,
      strength: r.strength ?? "",
      route: r.route ?? "Oral",
      frequency: r.frequency ?? "",
      duration: r.duration ?? "",
      refills: Number(r.refills),
      instructions: r.patientInstructions ?? "",
      status: "Active",
      createdAt: r.createdAt.toISOString(),
      finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString() : null,
      clinicianName: `Dr. ${r.clinicianFirstName} ${r.clinicianLastName}`.trim(),
      clinicianDepartment: r.clinicianDepartment ?? r.clinicianDesignation ?? "Care team",
      tenantName: r.tenantName,
    })),
  });
}
