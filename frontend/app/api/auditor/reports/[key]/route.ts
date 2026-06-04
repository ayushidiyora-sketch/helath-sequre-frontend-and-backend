import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ReportSection, ReportStat } from "@/lib/report-types";

export const runtime = "nodejs";

/**
 * Single-endpoint report engine for the Auditor + Compliance Manager reports
 * page. Returns a structured payload — `sections[]` containing paragraphs /
 * stat rows / tables — so the page can render a "View" modal and reuse the
 * same data for PDF / CSV downloads.
 *
 * Reports:
 *   compliance_summary  – posture, open anomalies, policy adoption
 *   access_report       – PHI access events (audit-log rows in last 30 days)
 *   consent_compliance  – active / revoked / expired + per-policy breakdown
 *   audit_summary       – event volume by category & status
 */

type Section = ReportSection;
type Stat = ReportStat;
void ({} as Stat); // keep the alias referenced for build tooling

const VALID_KEYS = new Set(["compliance_summary", "access_report", "consent_compliance", "audit_summary"]);

function fmtIst(d: Date): string {
  return d.toLocaleString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" });
}

async function tenantOf(uid: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${uid}::uuid LIMIT 1
  `;
  return rows[0]?.organizationId ?? null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!VALID_KEYS.has(key))
    return NextResponse.json({ ok: false, error: "Unknown report key." }, { status: 404 });

  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Auditor" && claims.role !== "Compliance Manager")
    return NextResponse.json({ ok: false, error: "Forbidden — Auditor / Compliance only." }, { status: 403 });
  if (!isDbUid(claims.uid))
    return NextResponse.json({
      ok: true,
      report: {
        key, title: titleFor(key), description: descFor(key),
        generatedAt: new Date().toISOString(),
        windowStart: null, windowEnd: null,
        sections: [{ kind: "paragraph", text: "Sign in with a real account to see the live report." }] as Section[],
      },
    });

  const orgId = await tenantOf(claims.uid);
  if (!orgId)
    return NextResponse.json({
      ok: true,
      report: {
        key, title: titleFor(key), description: descFor(key),
        generatedAt: new Date().toISOString(),
        windowStart: null, windowEnd: null,
        sections: [{ kind: "paragraph", text: "No tenant on this account — ask your admin to assign one." }] as Section[],
      },
    });

  const generatedAt = new Date();
  const windowEnd = generatedAt;
  const windowStart = new Date(generatedAt.getTime() - 30 * 24 * 60 * 60 * 1000);

  let sections: Section[] = [];
  if (key === "compliance_summary") sections = await buildComplianceSummary(orgId);
  else if (key === "access_report") sections = await buildAccessReport(orgId);
  else if (key === "consent_compliance") sections = await buildConsentCompliance(orgId);
  else if (key === "audit_summary") sections = await buildAuditSummary(orgId);

  return NextResponse.json({
    ok: true,
    report: {
      key,
      title: titleFor(key),
      description: descFor(key),
      generatedAt: generatedAt.toISOString(),
      generatedAtLabel: fmtIst(generatedAt),
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      sections,
    },
  });
}

function titleFor(k: string): string {
  switch (k) {
    case "compliance_summary": return "Compliance summary";
    case "access_report":      return "Access report";
    case "consent_compliance": return "Consent compliance";
    case "audit_summary":      return "Audit summary";
    default: return k;
  }
}
function descFor(k: string): string {
  switch (k) {
    case "compliance_summary": return "Posture, anomalies, policy adoption";
    case "access_report":      return "Who accessed which PHI when";
    case "consent_compliance": return "Active / revoked / policy coverage";
    case "audit_summary":      return "Event volume by category & status";
    default: return "";
  }
}

/* ─── builders ──────────────────────────────────────────────────────────── */

async function buildComplianceSummary(orgId: string): Promise<Section[]> {
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [activeConsents, audit24h, openAnomalies, policies] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM consent_requests WHERE "organizationId" = ${orgId}::uuid AND status = 'approved' AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`,
    countAuditEvents(orgId, since24),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM anomaly_decisions WHERE "organizationId" = ${orgId}::uuid AND status IN ('open','investigating')`,
    prisma.$queryRaw<{ version: string; status: string; consents: bigint }[]>`
      SELECT cp.version, cp.status,
             COALESCE((
               SELECT COUNT(*)::bigint FROM consent_requests cr
                WHERE cr."organizationId" = cp."organizationId"
                  AND cr.status = 'approved'
                  AND (cr."expiresAt" IS NULL OR cr."expiresAt" > NOW())
                  AND COALESCE(cr."decidedAt", cr."requestedAt") >= COALESCE(cp."activatedAt", cp."draftedAt")
                  AND (cp."archivedAt" IS NULL OR COALESCE(cr."decidedAt", cr."requestedAt") < cp."archivedAt")
             ), 0) AS consents
      FROM consent_policies cp
      WHERE cp."organizationId" = ${orgId}::uuid
      ORDER BY CASE cp.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, cp.version DESC
    `,
  ]);

  const activeN = Number(activeConsents[0]?.n ?? 0n);
  const totalActiveAcrossPolicies = policies.reduce((a, p) => a + Number(p.consents), 0) || 1;

  return [
    {
      kind: "paragraph",
      heading: "Posture summary",
      text: `${activeN.toLocaleString()} active consents in this tenant. ${audit24h.toLocaleString()} audit events captured in the last 24 hours. ${Number(openAnomalies[0]?.n ?? 0n)} open anomaly cases are pending review.`,
    },
    {
      kind: "stats",
      stats: [
        { label: "Active consents", value: activeN.toLocaleString() },
        { label: "Audit / 24h", value: audit24h.toLocaleString() },
        { label: "Open anomalies", value: String(Number(openAnomalies[0]?.n ?? 0n)) },
        { label: "Policy versions", value: String(policies.length) },
      ],
    },
    {
      kind: "table",
      heading: "Consent policy adoption",
      columns: ["Version", "Status", "Active consents", "Adoption %"],
      rows: policies.length === 0
        ? []
        : policies.map((p) => {
            const n = Number(p.consents);
            return [p.version, p.status, n.toString(), `${Math.round((n / totalActiveAcrossPolicies) * 100)}%`];
          }),
      empty: "No consent policies defined yet.",
    },
  ];
}

async function buildAccessReport(orgId: string): Promise<Section[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // Reuse the same UNION the audit-logs route uses, but trimmed to the
  // columns the access report needs.
  const consent = await prisma.$queryRaw<{ ts: Date; actor: string; verb: string; resource: string; status: string }[]>`
    SELECT cr."requestedAt" AS ts,
           c.email AS actor,
           'consent.request' AS verb,
           substring(cr.id::text, 1, 8) AS resource,
           'success' AS status
    FROM consent_requests cr
    JOIN users c ON c.id = cr."clinicianId"
    WHERE cr."organizationId" = ${orgId}::uuid AND cr."requestedAt" >= ${since}
    UNION ALL
    SELECT cr."decidedAt" AS ts,
           p.email AS actor,
           CASE cr.status WHEN 'approved' THEN 'consent.approve' WHEN 'declined' THEN 'consent.decline' ELSE 'consent.update' END AS verb,
           substring(cr.id::text, 1, 8) AS resource,
           CASE cr.status WHEN 'declined' THEN 'denied' ELSE 'success' END AS status
    FROM consent_requests cr
    JOIN users p ON p.id = cr."patientId"
    WHERE cr."organizationId" = ${orgId}::uuid AND cr."decidedAt" IS NOT NULL AND cr."decidedAt" >= ${since}
  `;
  const sessions = await prisma.$queryRaw<{ ts: Date; actor: string; verb: string; resource: string; status: string }[]>`
    SELECT s."issuedAt" AS ts, u.email AS actor, 'auth.session.create' AS verb,
           substring(s.id::text, 1, 8) AS resource, 'success' AS status
    FROM sessions s
    JOIN users u ON u.id = s."userId"
    WHERE u."organizationId" = ${orgId}::uuid AND s."issuedAt" >= ${since}
  `;
  const docs = await prisma.$queryRaw<{ ts: Date; actor: string; verb: string; resource: string; status: string }[]>`
    SELECT d."uploadedAt" AS ts, u.email AS actor,
           CASE d."scanStatus" WHEN 'infected' THEN 'documents.upload_infected' ELSE 'documents.upload' END AS verb,
           substring(d.id::text, 1, 8) AS resource,
           CASE d."scanStatus" WHEN 'infected' THEN 'failure' ELSE 'success' END AS status
    FROM patient_documents d
    JOIN users u ON u.id = d."patientId"
    WHERE d."organizationId" = ${orgId}::uuid AND d."uploadedAt" >= ${since} AND d."deletedAt" IS NULL
  `;

  const all = [...consent, ...sessions, ...docs]
    .filter((r) => r.ts)
    .sort((a, b) => b.ts.getTime() - a.ts.getTime())
    .slice(0, 200);

  return [
    {
      kind: "paragraph",
      heading: "Window",
      text: `Last 30 days — ${all.length} events. Showing newest 200.`,
    },
    {
      kind: "table",
      heading: "Access events",
      columns: ["Timestamp (IST)", "Actor", "Action", "Resource", "Status"],
      rows: all.map((r) => [fmtIst(r.ts), r.actor, r.verb, r.resource, r.status]),
      empty: "No access events in the last 30 days.",
    },
  ];
}

async function buildConsentCompliance(orgId: string): Promise<Section[]> {
  const [active, declined, expiredFlag, approvedButLapsed] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM consent_requests WHERE "organizationId" = ${orgId}::uuid AND status = 'approved' AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM consent_requests WHERE "organizationId" = ${orgId}::uuid AND status = 'declined'`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM consent_requests WHERE "organizationId" = ${orgId}::uuid AND status = 'expired'`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM consent_requests WHERE "organizationId" = ${orgId}::uuid AND status = 'approved' AND "expiresAt" IS NOT NULL AND "expiresAt" <= NOW()`,
  ]);
  const byClinician = await prisma.$queryRaw<{ clinician: string; n: bigint }[]>`
    SELECT u.email AS clinician, COUNT(*)::bigint AS n
    FROM consent_requests cr
    JOIN users u ON u.id = cr."clinicianId"
    WHERE cr."organizationId" = ${orgId}::uuid
    GROUP BY u.email
    ORDER BY n DESC
    LIMIT 10
  `;

  return [
    {
      kind: "stats",
      heading: "Coverage",
      stats: [
        { label: "Active", value: String(Number(active[0]?.n ?? 0n)) },
        { label: "Revoked (declined)", value: String(Number(declined[0]?.n ?? 0n)) },
        { label: "Expired", value: String(Number(expiredFlag[0]?.n ?? 0n) + Number(approvedButLapsed[0]?.n ?? 0n)) },
      ],
    },
    {
      kind: "table",
      heading: "Top requesting clinicians (all-time)",
      columns: ["Clinician", "Consent requests"],
      rows: byClinician.map((r) => [r.clinician, String(Number(r.n))]),
      empty: "No consent requests recorded yet.",
    },
  ];
}

async function buildAuditSummary(orgId: string): Promise<Section[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const byCategory = await prisma.$queryRaw<{ category: string; n: bigint }[]>`
    SELECT 'consent' AS category, COUNT(*)::bigint AS n FROM consent_requests
      WHERE "organizationId" = ${orgId}::uuid AND "requestedAt" >= ${since}
    UNION ALL
    SELECT 'session', COUNT(*)::bigint FROM sessions s JOIN users u ON u.id = s."userId"
      WHERE u."organizationId" = ${orgId}::uuid AND s."issuedAt" >= ${since}
    UNION ALL
    SELECT 'document', COUNT(*)::bigint FROM patient_documents
      WHERE "organizationId" = ${orgId}::uuid AND "uploadedAt" >= ${since} AND "deletedAt" IS NULL
    UNION ALL
    SELECT 'mfa_challenge', COUNT(*)::bigint FROM mfa_challenges mc JOIN users u ON u.id = mc."userId"
      WHERE u."organizationId" = ${orgId}::uuid AND mc."issuedAt" >= ${since}
    UNION ALL
    SELECT 'appointment', COUNT(*)::bigint FROM appointments
      WHERE "organizationId" = ${orgId}::uuid AND "createdAt" >= ${since} AND "deletedAt" IS NULL
  `;
  const total = byCategory.reduce((a, r) => a + Number(r.n), 0);

  return [
    { kind: "paragraph", heading: "Window", text: `Event volume over the last 30 days — ${total.toLocaleString()} total events across 5 categories.` },
    {
      kind: "table",
      heading: "By category",
      columns: ["Category", "Events"],
      rows: byCategory.map((r) => [r.category, String(Number(r.n))]),
      empty: "No events in this window.",
    },
  ];
}

/** Count of all auditable events in this tenant since `since`. Mirrors the
 *  UNION used by the audit-logs feed but compressed to a single COUNT(*). */
async function countAuditEvents(orgId: string, since: Date): Promise<number> {
  try {
    const r = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT (
        (SELECT COUNT(*) FROM consent_requests WHERE "organizationId" = ${orgId}::uuid AND "requestedAt" >= ${since}) +
        (SELECT COUNT(*) FROM consent_requests WHERE "organizationId" = ${orgId}::uuid AND "decidedAt" IS NOT NULL AND "decidedAt" >= ${since}) +
        (SELECT COUNT(*) FROM sessions s JOIN users u ON u.id = s."userId" WHERE u."organizationId" = ${orgId}::uuid AND s."issuedAt" >= ${since}) +
        (SELECT COUNT(*) FROM patient_documents WHERE "organizationId" = ${orgId}::uuid AND "uploadedAt" >= ${since} AND "deletedAt" IS NULL) +
        (SELECT COUNT(*) FROM mfa_challenges mc JOIN users u ON u.id = mc."userId" WHERE u."organizationId" = ${orgId}::uuid AND mc."issuedAt" >= ${since}) +
        (SELECT COUNT(*) FROM appointments WHERE "organizationId" = ${orgId}::uuid AND "createdAt" >= ${since} AND "deletedAt" IS NULL)
      )::bigint AS n
    `;
    return Number(r[0]?.n ?? 0n);
  } catch {
    return 0;
  }
}

export const dynamic = "force-dynamic";
