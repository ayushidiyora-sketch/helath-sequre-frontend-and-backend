import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardCompliance } from "@/lib/compliance-guard";

export const runtime = "nodejs";

/**
 * POST /api/compliance/retention/purge-now
 *
 * Records an off-cycle purge run in `retention_purge_runs`. In a real
 * deployment this would hand off to a worker; for the demo we compute
 * realistic counts from the actual content tables (medical_records,
 * patient_documents, messages) and insert a single row reflecting what
 * WOULD have been purged. Honors the tenant's `pausePurge` flag — if the
 * Compliance Manager has paused scheduled purges the off-cycle run is
 * rejected so the demo can't accidentally end-run the override.
 */

export async function POST() {
  const g = await guardCompliance();
  if ("error" in g) return g.error;

  const override = await prisma.$queryRaw<{ pausePurge: boolean }[]>`
    SELECT "pausePurge"
    FROM retention_overrides
    WHERE "organizationId" = ${g.orgId}::uuid
    LIMIT 1
  `;
  if (override[0]?.pausePurge) {
    return NextResponse.json(
      {
        ok: false,
        error: "Purge is paused for this tenant. Resume in Override controls before running.",
      },
      { status: 409 },
    );
  }

  // Best-effort counts of soft-deleted rows past their retention window.
  // Falls back to zero if a column is missing.
  const counts = await prisma.$queryRaw<{ docs: number; recs: number }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM patient_documents WHERE "organizationId" = ${g.orgId}::uuid AND "deletedAt" IS NOT NULL) AS docs,
      (SELECT COUNT(*)::int FROM medical_records WHERE "organizationId" = ${g.orgId}::uuid AND "deletedAt" IS NOT NULL) AS recs
  `;
  const purgedRecords = (counts[0]?.docs ?? 0) + (counts[0]?.recs ?? 0);
  // Demo: estimate ~350 KB per record. Real worker would compute the actual
  // freed bytes from the rows it touched.
  const bytesPurged = BigInt(purgedRecords) * BigInt(350 * 1024);
  const categories: string[] = [];
  if ((counts[0]?.docs ?? 0) > 0) categories.push("Documents");
  if ((counts[0]?.recs ?? 0) > 0) categories.push("Medical records");
  if (categories.length === 0) categories.push("Documents", "Messages");

  const me = await prisma.$queryRaw<{ email: string }[]>`
    SELECT email FROM users WHERE id = ${g.uid}::uuid LIMIT 1
  `;
  const actorEmail = me[0]?.email ?? null;
  const durationMs = 240_000 + Math.floor(purgedRecords * 18);

  const inserted = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO retention_purge_runs (
      "organizationId", "runAt", result, "recordsPurged", "bytesPurged",
      categories, "durationMs", note, "triggeredById", "triggeredByEmail"
    )
    VALUES (
      ${g.orgId}::uuid, NOW(), 'success', ${purgedRecords}, ${bytesPurged}::bigint,
      ${categories}::text[], ${durationMs}, ${"Off-cycle run · triggered from Retention page"},
      ${g.uid}::uuid, ${actorEmail}
    )
    RETURNING id
  `;

  return NextResponse.json({
    ok: true,
    runId: inserted[0]?.id,
    recordsPurged: purgedRecords,
    categories,
  });
}
