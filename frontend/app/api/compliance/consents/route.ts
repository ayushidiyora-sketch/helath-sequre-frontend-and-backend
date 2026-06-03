import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Compliance Manager → Organization-wide consent oversight feed.
 * Reads `consent_requests` for the signed-in user's tenant and maps the raw
 * lifecycle to the UI's three buckets (active / revoked / expired). Same
 * gate / short-circuit / tenant-scope pattern as the audit-logs and anomalies
 * routes.
 *
 * Status mapping:
 *   DB `approved` + expiresAt > NOW       → "active"
 *   DB `approved` + expiresAt <= NOW      → "expired" (consent silently
 *                                            timed out — same outcome as
 *                                            the cleanup job marking it
 *                                            `expired`)
 *   DB `expired`                          → "expired"
 *   DB `declined`                         → "revoked" (patient said no)
 *   DB `pending`                          → omitted (not yet a granted /
 *                                            denied record — pending lives
 *                                            on the Approvals page)
 *
 * Policy version is derived from the decided/requested date relative to
 * three rolling thresholds, so the "On stale policy" stat tile has real
 * meaning until a per-row policyVersion column lands.
 */

interface ConsentRow {
  id: string;
  patient: string;
  patientId: string;
  clinician: string;
  clinicianId: string;
  scope: string;           // joined string for backwards-compat with old UI
  scopes: string[];        // raw array for badge rendering
  status: "active" | "revoked" | "expired";
  version: string;
  date: string;            // short label like "May 10"
  requestedAt: string;     // ISO
  decidedAt: string | null;
  expiresAt: string | null;
  reason: string;
}

interface Stats {
  active: number;
  revoked: number;
  expired: number;
  onStalePolicy: number;
  stalePolicyLabel: string;
}

const POLICY_THRESHOLDS: Array<{ from: Date; version: string }> = [
  { from: new Date("2026-04-01T00:00:00Z"), version: "v2.4" },
  { from: new Date("2025-10-01T00:00:00Z"), version: "v2.3" },
  { from: new Date("2025-01-01T00:00:00Z"), version: "v2.2" },
  { from: new Date("2000-01-01T00:00:00Z"), version: "v2.1" },
];

function policyVersionAt(d: Date): string {
  for (const t of POLICY_THRESHOLDS) {
    if (d >= t.from) return t.version;
  }
  return "v2.0";
}

function currentPolicyVersion(): string {
  return POLICY_THRESHOLDS[0]?.version ?? "v2.0";
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function readScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function guard(): Promise<
  | { error: NextResponse; orgId?: never }
  | { error?: never; orgId: string }
> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims)
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Compliance Manager" && claims.role !== "Auditor")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Compliance / Auditor only." }, { status: 403 }) };
  if (!isDbUid(claims.uid)) {
    return {
      error: NextResponse.json({
        ok: true,
        consents: [],
        stats: { active: 0, revoked: 0, expired: 0, onStalePolicy: 0, stalePolicyLabel: currentPolicyVersion() },
        policyVersions: [],
      }),
    };
  }

  const rows = await prisma.$queryRaw<{ organizationId: string | null }[]>`
    SELECT "organizationId" FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  const orgId = rows[0]?.organizationId;
  if (!orgId)
    return {
      error: NextResponse.json({
        ok: true,
        consents: [],
        stats: { active: 0, revoked: 0, expired: 0, onStalePolicy: 0, stalePolicyLabel: currentPolicyVersion() },
        policyVersions: [],
      }),
    };
  return { orgId };
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;

  const rows = await prisma.$queryRaw<{
    id: string;
    patientId: string;
    clinicianId: string;
    patientFirstName: string | null;
    patientLastName: string | null;
    patientEmail: string;
    clinicianFirstName: string | null;
    clinicianLastName: string | null;
    clinicianEmail: string;
    scopes: unknown;
    status: string;
    requestedAt: Date;
    decidedAt: Date | null;
    expiresAt: Date | null;
    reason: string;
  }[]>`
    SELECT cr.id,
           cr."patientId",
           cr."clinicianId",
           p."firstName" AS "patientFirstName",
           p."lastName"  AS "patientLastName",
           p.email       AS "patientEmail",
           c."firstName" AS "clinicianFirstName",
           c."lastName"  AS "clinicianLastName",
           c.email       AS "clinicianEmail",
           cr.scopes,
           cr.status,
           cr."requestedAt",
           cr."decidedAt",
           cr."expiresAt",
           cr.reason
    FROM consent_requests cr
    JOIN users p ON p.id = cr."patientId"
    JOIN users c ON c.id = cr."clinicianId"
    WHERE cr."organizationId" = ${g.orgId}::uuid
      AND cr.status IN ('approved','declined','expired')
    ORDER BY COALESCE(cr."decidedAt", cr."requestedAt") DESC
    LIMIT 500
  `;

  const now = new Date();
  const consents: ConsentRow[] = rows.map((r) => {
    let status: ConsentRow["status"];
    if (r.status === "declined") status = "revoked";
    else if (r.status === "expired") status = "expired";
    else if (r.expiresAt && r.expiresAt <= now) status = "expired";
    else status = "active";

    const scopes = readScopes(r.scopes).map(capitalize);
    const decisionDate = r.decidedAt ?? r.requestedAt;
    const version = policyVersionAt(decisionDate);
    const patientFull = [r.patientFirstName, r.patientLastName].filter(Boolean).join(" ").trim() || r.patientEmail;
    const clinicianFull = [r.clinicianFirstName, r.clinicianLastName].filter(Boolean).join(" ").trim();
    const clinician = clinicianFull ? `Dr. ${clinicianFull}` : r.clinicianEmail;

    return {
      id: r.id,
      patient: patientFull,
      patientId: r.patientId,
      clinician,
      clinicianId: r.clinicianId,
      scope: scopes.join(" + ") || "—",
      scopes,
      status,
      version,
      date: shortDate(decisionDate),
      requestedAt: r.requestedAt.toISOString(),
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      reason: r.reason,
    };
  });

  const current = currentPolicyVersion();
  const stats: Stats = {
    active: consents.filter((c) => c.status === "active").length,
    revoked: consents.filter((c) => c.status === "revoked").length,
    expired: consents.filter((c) => c.status === "expired").length,
    onStalePolicy: consents.filter((c) => c.status === "active" && c.version !== current).length,
    stalePolicyLabel: current,
  };

  const policyVersions = Array.from(new Set(consents.map((c) => c.version))).sort().reverse();

  return NextResponse.json({ ok: true, consents, stats, policyVersions });
}
