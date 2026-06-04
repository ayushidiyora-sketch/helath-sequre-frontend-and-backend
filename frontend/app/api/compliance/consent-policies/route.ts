import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { guardCompliance } from "@/lib/compliance-guard";

export const runtime = "nodejs";

/**
 * Compliance Manager → Consent policies catalog. Each tenant has its own
 * versioned policy text; activating a new version archives the prior active
 * one. Same gate / short-circuit / tenant-scope pattern as the audit-logs,
 * anomalies, and consents routes.
 *
 * GET    /api/compliance/consent-policies        — list with stats
 * POST   /api/compliance/consent-policies        — create a new draft
 * Single-policy GET/PATCH live on the /[id] sub-route.
 */

const SECTION_HEADINGS = [
  "Purpose & scope",
  "PHI categories covered",
  "Retention & data portability",
  "Re-consent & revocation",
];

interface PolicySection {
  heading: string;
  body: string;
}

interface HistoryEntry {
  date: string;
  event: string;
}

interface PolicyRow {
  id: string;
  version: string;
  slug: string;
  status: string;
  summary: string;
  sections: Prisma.JsonValue;
  scopeCategories: number;
  roleBindings: number;
  effectiveDate: Date | null;
  activatedAt: Date | null;
  archivedAt: Date | null;
  draftedAt: Date;
  history: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

interface PolicyOut {
  id: string;
  version: string;
  slug: string;
  status: "active" | "archived" | "draft";
  summary: string;
  period: string;
  sections: PolicySection[];
  history: HistoryEntry[];
  scopeCategories: number;
  roleBindings: number;
  adoption: number;
  consents: number;
  effectiveDate: string | null;
  activatedAt: string | null;
  archivedAt: string | null;
}

function readSections(raw: Prisma.JsonValue): PolicySection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is { heading: string; body: string } =>
      !!s && typeof s === "object" && typeof (s as { heading?: unknown }).heading === "string" && typeof (s as { body?: unknown }).body === "string",
    );
}

function readHistory(raw: Prisma.JsonValue): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h): h is { date: string; event: string } =>
      !!h && typeof h === "object" && typeof (h as { date?: unknown }).date === "string" && typeof (h as { event?: unknown }).event === "string",
    );
}

function formatPeriod(p: PolicyRow): string {
  if (p.status === "active" && p.activatedAt) {
    return `Activated ${p.activatedAt.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  if (p.status === "archived" && p.activatedAt && p.archivedAt) {
    const from = p.activatedAt.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    const fromYr = p.activatedAt.getFullYear();
    const to = p.archivedAt.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    const toYr = p.archivedAt.getFullYear();
    if (fromYr === toYr) return `Active ${from} – ${to}, ${toYr}`;
    return `Active ${from}, ${fromYr} – ${to}, ${toYr}`;
  }
  if (p.status === "draft") {
    return `Drafted ${p.draftedAt.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return "";
}

function shape(p: PolicyRow, consents: number, totalActive: number): PolicyOut {
  return {
    id: p.id,
    version: p.version,
    slug: p.slug,
    status: (p.status === "active" || p.status === "archived" || p.status === "draft") ? p.status : "draft",
    summary: p.summary,
    period: formatPeriod(p),
    sections: readSections(p.sections),
    history: readHistory(p.history),
    scopeCategories: p.scopeCategories,
    roleBindings: p.roleBindings,
    adoption: totalActive > 0 ? Math.round((consents / totalActive) * 100) : 0,
    consents,
    effectiveDate: p.effectiveDate ? p.effectiveDate.toISOString().slice(0, 10) : null,
    activatedAt: p.activatedAt ? p.activatedAt.toISOString() : null,
    archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
  };
}

/**
 * For each policy version, count the patients who EXPLICITLY approved that
 * policy via a re-consent campaign (`re_consent_responses.response =
 * 'approved'`). Plus a fallback for the policy that was active when a
 * patient FIRST granted consent (so policies that pre-date the re-consent
 * system still show non-zero numbers): `consent_requests` rows whose
 * decidedAt falls inside the policy's `[activatedAt, archivedAt)` window
 * and still represent live consent. The two sources are unioned on
 * patientId so a patient who both originally consented under v2.3 AND
 * approved the v2.4 re-consent doesn't double-count.
 */
async function consentsByPolicy(orgId: string, policies: PolicyRow[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const p of policies) {
    counts.set(p.id, 0);
    try {
      // Live re-consent approvals (the gold banner → Approve flow).
      const approvedRespRows = await prisma.$queryRaw<{ patientId: string }[]>`
        SELECT DISTINCT "patientId"
        FROM re_consent_responses
        WHERE "organizationId" = ${orgId}::uuid
          AND "policyId" = ${p.id}::uuid
          AND response = 'approved'
      `;
      // Original consents decided while this policy was the active version.
      const originalRows = p.activatedAt
        ? await prisma.$queryRaw<{ patientId: string }[]>`
            SELECT DISTINCT "patientId"
            FROM consent_requests
            WHERE "organizationId" = ${orgId}::uuid
              AND status = 'approved'
              AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
              AND COALESCE("decidedAt", "requestedAt") >= ${p.activatedAt}
              AND COALESCE("decidedAt", "requestedAt") <  ${p.archivedAt ?? new Date("9999-12-31T00:00:00Z")}
          `
        : [];
      // Union by patientId so a patient who both originally consented under
      // this policy AND re-consented through the campaign counts once.
      const uniq = new Set<string>();
      for (const r of approvedRespRows) uniq.add(r.patientId);
      for (const r of originalRows) uniq.add(r.patientId);
      counts.set(p.id, uniq.size);
    } catch (err) {
      console.error("[consent-policies] count for", p.version, err);
    }
  }
  return counts;
}

export async function GET() {
  const g = await guardCompliance();
  if ("error" in g) return g.error;

  const rows = await prisma.$queryRaw<PolicyRow[]>`
    SELECT id, version, slug, status, summary, sections,
           "scopeCategories", "roleBindings", "effectiveDate",
           "activatedAt", "archivedAt", "draftedAt", history,
           "createdAt", "updatedAt"
    FROM consent_policies
    WHERE "organizationId" = ${g.orgId}::uuid
    ORDER BY
      CASE status WHEN 'draft' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
      COALESCE("activatedAt", "draftedAt") DESC
  `;

  const counts = await consentsByPolicy(g.orgId, rows);
  const totalActive = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const policies = rows.map((p) => shape(p, counts.get(p.id) ?? 0, totalActive));

  return NextResponse.json({ ok: true, policies });
}

interface PostBody {
  version?: string;
  effectiveDate?: string | null;
  summary?: string;
  sections?: { heading: string; body: string }[];
  scopeCategories?: number;
  roleBindings?: number;
}

function slugify(version: string): string {
  return version.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  const g = await guardCompliance();
  if ("error" in g) return g.error;

  let body: PostBody;
  try { body = (await req.json()) as PostBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const version = (body.version ?? "").trim();
  if (!version || version.length > 24)
    return NextResponse.json({ ok: false, error: "Valid version label required (e.g. v2.5)." }, { status: 400 });
  const summary = (body.summary ?? "").trim();
  if (!summary || summary.length > 400)
    return NextResponse.json({ ok: false, error: "One-line summary required." }, { status: 400 });

  const incomingSections = Array.isArray(body.sections) ? body.sections : [];
  const sections: PolicySection[] = SECTION_HEADINGS.map((heading, i) => ({
    heading,
    body: (incomingSections[i]?.body ?? "").trim(),
  }));
  if (sections.some((s) => !s.body))
    return NextResponse.json({ ok: false, error: "All four sections need legal text." }, { status: 400 });

  const scopeCategories = Number.isFinite(body.scopeCategories)
    ? Math.max(1, Math.min(50, Math.floor(Number(body.scopeCategories))))
    : 7;
  const roleBindings = Number.isFinite(body.roleBindings)
    ? Math.max(1, Math.min(50, Math.floor(Number(body.roleBindings))))
    : 3;

  const slug = slugify(version);
  const today = new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  const history: HistoryEntry[] = [{ date: today, event: `${version} drafted` }];

  try {
    const inserted = await prisma.$queryRaw<{ id: string; version: string; slug: string }[]>`
      INSERT INTO consent_policies (
        "organizationId", version, slug, status, summary, sections,
        "scopeCategories", "roleBindings", "effectiveDate",
        "createdById", history
      ) VALUES (
        ${g.orgId}::uuid, ${version}, ${slug}, 'draft', ${summary},
        ${JSON.stringify(sections)}::jsonb,
        ${scopeCategories}, ${roleBindings},
        ${body.effectiveDate ? body.effectiveDate : null}::date,
        ${g.uid}::uuid, ${JSON.stringify(history)}::jsonb
      )
      RETURNING id, version, slug
    `;
    return NextResponse.json({ ok: true, policy: inserted[0] }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("consent_policies_org_version_unique") || msg.includes("consent_policies_org_slug_unique")) {
      return NextResponse.json({ ok: false, error: `A policy with version ${version} already exists in this tenant.` }, { status: 409 });
    }
    console.error("[consent-policies] POST", err);
    return NextResponse.json({ ok: false, error: "Could not save policy." }, { status: 500 });
  }
}
