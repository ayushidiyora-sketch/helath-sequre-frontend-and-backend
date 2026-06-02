import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface RxRow {
  id: string;
  drugName: string;
  strength: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  refills: number;
  patientInstructions: string | null;
  finalizedAt: Date | null;
  createdAt: Date;
  clinicianFirstName: string;
  clinicianLastName: string;
  tenantName: string | null;
}

interface NoteRow {
  id: string;
  template: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  body: string | null;
  finalizedAt: Date | null;
  createdAt: Date;
  clinicianFirstName: string;
  clinicianLastName: string;
  tenantName: string | null;
}

/**
 * Unified medical-history feed for the patient. Aggregates:
 *   - finalized prescriptions  → category "Prescription"
 *   - finalized SOAP/Progress notes → category "Clinical Note"
 *   - finalized Discharge summaries → category "Discharge"
 *
 * Lab reports + Imaging require dedicated tables we haven't built yet; the
 * page renders an empty state for those categories. The shape matches the
 * patient records page's existing `RecordDetail` so the UI can render without
 * a refactor: id, title, category, clinician, date, status, subtitle, etc.
 */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, records: [] });

  const [rxs, notes] = await Promise.all([
    prisma.$queryRaw<RxRow[]>`
      SELECT p.id, p."drugName", p.strength, p.route, p.frequency, p.duration,
             p.refills, p."patientInstructions", p."finalizedAt", p."createdAt",
             u."firstName" AS "clinicianFirstName",
             u."lastName"  AS "clinicianLastName",
             o.name        AS "tenantName"
      FROM prescriptions p
      JOIN users u ON u.id = p."clinicianId"
      LEFT JOIN organizations o ON o.id = p."organizationId"
      WHERE p."patientId" = ${claims.uid}::uuid
        AND p."deletedAt" IS NULL
        AND p.status = 'finalized'
      ORDER BY p."finalizedAt" DESC NULLS LAST, p."createdAt" DESC
    `,
    prisma.$queryRaw<NoteRow[]>`
      SELECT m.id, m.template, m.subjective, m.objective, m.assessment, m.plan,
             m.body, m."finalizedAt", m."createdAt",
             u."firstName" AS "clinicianFirstName",
             u."lastName"  AS "clinicianLastName",
             o.name        AS "tenantName"
      FROM medical_records m
      JOIN users u ON u.id = m."clinicianId"
      LEFT JOIN organizations o ON o.id = m."organizationId"
      WHERE m."patientId" = ${claims.uid}::uuid
        AND m."deletedAt" IS NULL
        AND m.status = 'finalized'
      ORDER BY m."finalizedAt" DESC NULLS LAST, m."createdAt" DESC
    `,
  ]);

  const rxRecords = rxs.map((r) => {
    const ts = (r.finalizedAt ?? r.createdAt).toISOString();
    return {
      id: r.id,
      kind: "prescription" as const,
      title: `${r.drugName}${r.strength ? ` · ${r.strength}` : ""}`,
      subtitle: [r.route, r.frequency, r.duration].filter(Boolean).join(" · ") || "Prescription",
      category: "Prescription" as const,
      clinician: `Dr. ${r.clinicianFirstName} ${r.clinicianLastName}`.trim(),
      facility: r.tenantName ?? "",
      date: ts.slice(0, 10),
      status: "Active" as const,
      prescription: {
        drug: r.drugName,
        strength: r.strength ?? "",
        form: r.route ?? "Oral",
        frequency: r.frequency ?? "",
        duration: r.duration ?? "",
        refills: String(r.refills ?? 0),
        instructions: r.patientInstructions ?? "",
      },
    };
  });

  const noteRecords = notes.map((n) => {
    const ts = (n.finalizedAt ?? n.createdAt).toISOString();
    const isDischarge = n.template === "Discharge";
    const noteBody =
      n.body ??
      [
        n.subjective ? `Subjective: ${n.subjective}` : "",
        n.objective ? `Objective: ${n.objective}` : "",
        n.assessment ? `Assessment: ${n.assessment}` : "",
        n.plan ? `Plan: ${n.plan}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    return {
      id: n.id,
      kind: "note" as const,
      title: isDischarge ? "Discharge summary" : `${n.template} note`,
      subtitle: `${n.template} · finalized`,
      category: (isDischarge ? "Discharge" : "Clinical Note") as "Discharge" | "Clinical Note",
      clinician: `Dr. ${n.clinicianFirstName} ${n.clinicianLastName}`.trim(),
      facility: n.tenantName ?? "",
      date: ts.slice(0, 10),
      status: "Finalized" as const,
      noteBody,
    };
  });

  // Merge + sort by date desc.
  const records = [...rxRecords, ...noteRecords].sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json({ ok: true, records });
}
