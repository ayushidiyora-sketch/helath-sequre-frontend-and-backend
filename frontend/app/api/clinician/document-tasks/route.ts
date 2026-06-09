import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Patient-uploaded documents across the signed-in clinician's panel — these roll
 * up as "review" tasks on the clinician Pending-tasks page. Only files the
 * PATIENT uploaded themselves (`uploadedById = patientId`) for patients on the
 * clinician's active care team are returned, so the clinician sees what their
 * patients submitted and can preview each.
 */

interface Row {
  id: string;
  name: string;
  category: string;
  mimeType: string | null;
  sizeBytes: number;
  dataUrl: string | null;
  uploadedAt: Date;
  patientId: string;
  patientFirst: string;
  patientLast: string;
}

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Clinician")
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 });
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, tasks: [] });

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT d.id, d.name, d.category, d."mimeType", d."sizeBytes", d."dataUrl", d."uploadedAt",
           d."patientId"::text AS "patientId",
           pu."firstName" AS "patientFirst", pu."lastName" AS "patientLast"
    FROM patient_documents d
    JOIN patient_assignments pa
      ON pa."patientId" = d."patientId"
     AND pa."clinicianId" = ${claims.uid}::uuid
     AND pa."endedAt" IS NULL
    JOIN users pu ON pu.id = d."patientId"
    WHERE d."deletedAt" IS NULL
      AND d."uploadedById" = d."patientId"
    ORDER BY d."uploadedAt" DESC
    LIMIT 50
  `;

  return NextResponse.json({
    ok: true,
    tasks: rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      dataUrl: r.dataUrl,
      uploadedAt: r.uploadedAt.toISOString(),
      patientId: r.patientId,
      patientName: `${r.patientFirst} ${r.patientLast}`.trim(),
    })),
  });
}
