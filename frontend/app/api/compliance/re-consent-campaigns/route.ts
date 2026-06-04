import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardCompliance } from "@/lib/compliance-guard";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * List campaigns for the signed-in Compliance Manager's tenant. Returns
 * per-campaign counts (target, approved, declined, pending) computed live
 * from `re_consent_responses`, so the progress bar on /compliance/campaigns
 * reflects the actual patient response state — no mock data.
 */
export async function GET() {
  const g = await guardCompliance();
  if ("error" in g) return g.error;

  const rows = await prisma.$queryRaw<{
    id: string;
    policyId: string;
    policyVersion: string;
    recipientCount: number;
    status: string;
    triggeredAt: Date;
    completedAt: Date | null;
    activatedAt: Date | null;
    target: bigint;
    approved: bigint;
    declined: bigint;
    pending: bigint;
  }[]>`
    SELECT rcc.id, rcc."policyId", rcc."policyVersion", rcc."recipientCount",
           rcc.status, rcc."triggeredAt", rcc."completedAt",
           cp."activatedAt",
           COUNT(rcr.id)::bigint                                             AS target,
           COUNT(rcr.id) FILTER (WHERE rcr.response = 'approved')::bigint    AS approved,
           COUNT(rcr.id) FILTER (WHERE rcr.response = 'declined')::bigint    AS declined,
           COUNT(rcr.id) FILTER (WHERE rcr.response = 'pending')::bigint     AS pending
    FROM re_consent_campaigns rcc
    LEFT JOIN consent_policies cp ON cp.id = rcc."policyId"
    LEFT JOIN re_consent_responses rcr ON rcr."campaignId" = rcc.id
    WHERE rcc."organizationId" = ${g.orgId}::uuid
    GROUP BY rcc.id, cp."activatedAt"
    ORDER BY rcc."triggeredAt" DESC
  `;

  const campaigns = rows.map((r) => {
    const target = Number(r.target) || r.recipientCount;
    const approved = Number(r.approved);
    const declined = Number(r.declined);
    const pending = Number(r.pending);
    const responded = approved + declined;
    const pct = target > 0 ? Math.round((approved / target) * 100) : 0;
    // Auto-complete: when nobody is pending, treat the campaign as done so
    // the UI can move it to the Completed tab even if Compliance hasn't
    // manually flipped the status.
    const computedStatus = pending === 0 && target > 0 ? "completed" : r.status;
    return {
      id: r.id,
      policyId: r.policyId,
      policyVersion: r.policyVersion,
      status: computedStatus,
      triggeredAt: r.triggeredAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      activatedAt: r.activatedAt ? r.activatedAt.toISOString() : null,
      target,
      approved,
      declined,
      pending,
      responded,
      remaining: pending,
      pct,
      channels: ["email", "in_app", "sms"] as const,
    };
  });

  return NextResponse.json({ ok: true, campaigns });
}

/**
 * Compliance triggers a re-consent campaign for a specific policy. We record
 * the dispatch in `re_consent_campaigns` so the audit ledger and the
 * /compliance/campaigns page have something real to read; the actual bulk
 * mailer is out of scope for this slice.
 */
export async function POST(req: Request) {
  const g = await guardCompliance();
  if ("error" in g) return g.error;

  let body: { policyId?: string };
  try { body = await req.json() as { policyId?: string }; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const policyId = (body.policyId ?? "").trim();
  if (!UUID_RE.test(policyId))
    return NextResponse.json({ ok: false, error: "Valid policyId required." }, { status: 400 });

  const policy = await prisma.$queryRaw<{ id: string; version: string; status: string; activatedAt: Date | null }[]>`
    SELECT id, version, status, "activatedAt"
    FROM consent_policies
    WHERE id = ${policyId}::uuid AND "organizationId" = ${g.orgId}::uuid
    LIMIT 1
  `;
  if (!policy[0])
    return NextResponse.json({ ok: false, error: "Policy not found." }, { status: 404 });
  if (policy[0].status !== "active")
    return NextResponse.json({ ok: false, error: "Re-consent campaigns can only target the active policy." }, { status: 409 });

  // Find the patient pool. We UNION three sources so the gold banner reaches
  // every patient who could plausibly need to re-consent under the new
  // policy:
  //   (a) any patient with an approved + non-expired consent that was
  //       decided BEFORE this policy activated (the strict "still on prior
  //       version" definition);
  //   (b) any patient who has EVER had a consent_request in this tenant
  //       (covers expired/declined rows so the demo doesn't skip patients
  //       whose 24-hour consents have already lapsed);
  //   (c) any patient with an active assignment to a clinician in this
  //       tenant (covers patients who haven't booked or consented yet but
  //       are on a care team).
  const idSet = new Set<string>();
  try {
    if (policy[0].activatedAt) {
      const rows = await prisma.$queryRaw<{ patientId: string }[]>`
        SELECT DISTINCT cr."patientId"
        FROM consent_requests cr
        WHERE cr."organizationId" = ${g.orgId}::uuid
          AND cr.status = 'approved'
          AND (cr."expiresAt" IS NULL OR cr."expiresAt" > NOW())
          AND COALESCE(cr."decidedAt", cr."requestedAt") < ${policy[0].activatedAt}
      `;
      for (const r of rows) idSet.add(r.patientId);
    }
    const anyConsentRows = await prisma.$queryRaw<{ patientId: string }[]>`
      SELECT DISTINCT cr."patientId"
      FROM consent_requests cr
      WHERE cr."organizationId" = ${g.orgId}::uuid
    `;
    for (const r of anyConsentRows) idSet.add(r.patientId);
    const assignedRows = await prisma.$queryRaw<{ patientId: string }[]>`
      SELECT DISTINCT pa."patientId"
      FROM patient_assignments pa
      JOIN users c ON c.id = pa."clinicianId"
      WHERE pa."endedAt" IS NULL
        AND c."organizationId" = ${g.orgId}::uuid
    `;
    for (const r of assignedRows) idSet.add(r.patientId);
  } catch (err) {
    console.error("[re-consent-campaigns] enumerate recipients", err);
  }
  const recipientPatientIds = Array.from(idSet);
  const recipientCount = recipientPatientIds.length;

  const inserted = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO re_consent_campaigns (
      "organizationId", "policyId", "policyVersion", "recipientCount",
      status, "triggeredById"
    ) VALUES (
      ${g.orgId}::uuid, ${policy[0].id}::uuid, ${policy[0].version},
      ${recipientCount}, 'queued', ${g.uid}::uuid
    )
    RETURNING id
  `;
  const campaignId = inserted[0].id;

  // Insert one pending response row per patient. ON CONFLICT lets the
  // clinician re-trigger the same campaign without crashing on duplicates
  // — already-responded patients keep their prior decision.
  for (const pid of recipientPatientIds) {
    try {
      await prisma.$executeRaw`
        INSERT INTO re_consent_responses
          ("campaignId", "organizationId", "patientId", "policyId",
           "policyVersion", response)
        VALUES
          (${campaignId}::uuid, ${g.orgId}::uuid, ${pid}::uuid,
           ${policy[0].id}::uuid, ${policy[0].version}, 'pending')
        ON CONFLICT ("campaignId", "patientId") DO NOTHING
      `;
    } catch (err) {
      console.error("[re-consent-campaigns] response insert failed for", pid, err);
    }
  }

  // Stamp the campaign onto the policy's history so the timeline reflects it.
  const today = new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  const event = { date: today, event: `Re-consent campaign dispatched to ${recipientCount.toLocaleString()} patients` };
  await prisma.$executeRaw`
    UPDATE consent_policies
    SET history = COALESCE(history, '[]'::jsonb) || ${JSON.stringify([event])}::jsonb,
        "updatedAt" = NOW()
    WHERE id = ${policy[0].id}::uuid
  `;

  return NextResponse.json({ ok: true, campaign: { id: inserted[0].id, recipientCount } }, { status: 201 });
}
