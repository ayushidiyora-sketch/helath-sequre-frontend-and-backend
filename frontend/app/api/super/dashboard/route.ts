import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/super/dashboard
 *
 * Super Admin landing-page payload. Cross-tenant aggregates — no PHI is
 * surfaced, only counts and metadata. Every number comes from a real table:
 *  - activeTenants / totalUsers   → organizations + users
 *  - auditEventsPerDay            → sessions + appointment_audit_log + messages + anomaly_decisions in the last 24h
 *  - securityEvents24h            → failed MFA challenges + lockouts + brute-force flags in the last 24h
 *  - apiLatencyMs                 → measured round-trip of the dashboard query bundle
 *  - errorRatePct                 → open incidents / (open incidents + resolved-in-7d), capped to 100
 *  - queueDepth                   → unread notifications + pending re-consent responses
 *  - dbConnections                → pg_stat_activity
 *  - recentTenants                → organizations ORDER BY createdAt DESC LIMIT 5 with user count + storage MB
 *  - platformConfig               → counts derived from real enum / settings rows
 *  - activeIncidents              → incidents WHERE status <> 'resolved'
 */

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  type: string;
  tier: string;
  status: string;
  region: string;
  createdAt: Date;
  userCount: number;
  storageBytes: bigint | number | null;
}

interface IncidentRow {
  id: string;
  number: number;
  title: string;
  severity: string;
  status: string;
  scope: string | null;
  openedAt: Date;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatStorage(bytes: bigint | number | null): string {
  const v = bytes == null ? 0 : typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!Number.isFinite(v) || v <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let x = v;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(x >= 100 ? 0 : 1)} ${units[i]}`;
}

function formatJoined(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function relTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function compactCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  return `${(n / 1_000_000_000).toFixed(1).replace(".0", "")}B`;
}

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  if (claims.role !== "Super Admin") {
    return NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 });
  }

  const startedAt = Date.now();

  // ─── Top stats: tenants, users, audit/day, security/24h ─────────────────
  const [topCounts] = await prisma.$queryRaw<
    {
      active_tenants: number;
      tenants_this_quarter: number;
      total_users: number;
      audit_24h: number;
      security_24h: number;
    }[]
  >`
    SELECT
      (SELECT COUNT(*)::int FROM organizations WHERE status = 'active'::"TenantStatus") AS active_tenants,
      (SELECT COUNT(*)::int FROM organizations WHERE "createdAt" >= NOW() - INTERVAL '90 days') AS tenants_this_quarter,
      (SELECT COUNT(*)::int FROM users WHERE "deletedAt" IS NULL) AS total_users,
      (
        (SELECT COUNT(*)::int FROM sessions WHERE "issuedAt" >= NOW() - INTERVAL '24 hours')
        + (SELECT COUNT(*)::int FROM appointment_audit_log WHERE "createdAt" >= NOW() - INTERVAL '24 hours')
        + (SELECT COUNT(*)::int FROM messages WHERE "sentAt" >= NOW() - INTERVAL '24 hours')
        + (SELECT COUNT(*)::int FROM anomaly_decisions WHERE "decidedAt" >= NOW() - INTERVAL '24 hours')
      ) AS audit_24h,
      (
        (SELECT COUNT(*)::int FROM mfa_challenges WHERE "issuedAt" >= NOW() - INTERVAL '24 hours' AND "usedAt" IS NULL AND "expiresAt" < NOW())
        + (SELECT COUNT(*)::int FROM users WHERE "lockedUntil" IS NOT NULL AND "lockedUntil" > NOW())
        + (SELECT COUNT(*)::int FROM anomaly_decisions WHERE "createdAt" >= NOW() - INTERVAL '24 hours')
      ) AS security_24h
  `;

  // ─── Platform health: errors, queue depth, DB connections ──────────────
  const [healthBits] = await prisma.$queryRaw<
    {
      open_incidents: number;
      recent_resolved: number;
      unread_notifications: number;
      pending_reconsents: number;
      db_active: number;
      db_max: number;
    }[]
  >`
    SELECT
      (SELECT COUNT(*)::int FROM incidents WHERE status <> 'resolved') AS open_incidents,
      (SELECT COUNT(*)::int FROM incidents WHERE status = 'resolved' AND "resolvedAt" >= NOW() - INTERVAL '7 days') AS recent_resolved,
      (SELECT COUNT(*)::int FROM messages WHERE "readAt" IS NULL) AS unread_notifications,
      (SELECT COUNT(*)::int FROM re_consent_responses WHERE response = 'pending') AS pending_reconsents,
      (SELECT COUNT(*)::int FROM pg_stat_activity WHERE state = 'active') AS db_active,
      (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS db_max
  `;

  // ─── Recent tenants (5) with user counts + storage ───────────────────────
  const recentTenants = await prisma.$queryRaw<TenantRow[]>`
    SELECT
      o.id, o.slug, o.name, o.type::text AS type, o.tier::text AS tier,
      o.status::text AS status, o.region, o."createdAt",
      (SELECT COUNT(*)::int FROM users u WHERE u."organizationId" = o.id AND u."deletedAt" IS NULL) AS "userCount",
      (SELECT COALESCE(SUM("sizeBytes"), 0)::bigint FROM patient_documents pd WHERE pd."organizationId" = o.id AND pd."deletedAt" IS NULL) AS "storageBytes"
    FROM organizations o
    WHERE o.status <> 'suspended'
    ORDER BY o."createdAt" DESC
    LIMIT 5
  `;

  // ─── Active incidents (top 5 open / investigating) ──────────────────────
  const incidents = await prisma.$queryRaw<IncidentRow[]>`
    SELECT id, number, title, severity, status, scope, "openedAt"
    FROM incidents
    WHERE status <> 'resolved'
    ORDER BY
      CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      "openedAt" DESC
    LIMIT 5
  `;

  // ─── Platform config (real counts from the schema) ──────────────────────
  const [configCounts] = await prisma.$queryRaw<
    {
      enabled_flags: number;
      tier_count: number;
      role_count: number;
      region_count: number;
    }[]
  >`
    SELECT
      (SELECT COUNT(*)::int FROM organizations WHERE "multiAzEnabled" = true OR "crossRegionS3" = true) AS enabled_flags,
      (SELECT COUNT(DISTINCT tier)::int FROM organizations) AS tier_count,
      (SELECT COUNT(DISTINCT name)::int FROM roles) AS role_count,
      (SELECT COUNT(DISTINCT region)::int FROM organizations) AS region_count
  `;

  const apiLatencyMs = Date.now() - startedAt;
  const openIncidents = healthBits?.open_incidents ?? 0;
  const recentResolved = healthBits?.recent_resolved ?? 0;
  const denom = openIncidents + recentResolved;
  const errorRatePct = denom > 0 ? Math.min(100, (openIncidents / denom) * 100) : 0;
  const queueDepth = (healthBits?.unread_notifications ?? 0) + (healthBits?.pending_reconsents ?? 0);
  const dbActive = healthBits?.db_active ?? 0;
  const dbMax = healthBits?.db_max ?? 100;

  const stats = {
    activeTenants: topCounts?.active_tenants ?? 0,
    tenantsThisQuarter: topCounts?.tenants_this_quarter ?? 0,
    totalUsers: topCounts?.total_users ?? 0,
    totalUsersDisplay: compactCount(topCounts?.total_users ?? 0),
    auditEventsPerDay: topCounts?.audit_24h ?? 0,
    auditEventsPerDayDisplay: compactCount(topCounts?.audit_24h ?? 0),
    securityEvents24h: topCounts?.security_24h ?? 0,
    securityEscalated:
      (await prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM anomaly_decisions
        WHERE "createdAt" >= NOW() - INTERVAL '24 hours' AND status = 'investigating'
      `)[0]?.n ?? 0,
  };

  const health = {
    apiLatencyMs,
    apiLatencyOk: apiLatencyMs < 1500,
    errorRatePct: Number(errorRatePct.toFixed(2)),
    errorRateOk: errorRatePct < 5,
    queueDepth,
    queueDepthOk: queueDepth < 1000,
    dbActive,
    dbMax,
    dbConnectionsOk: dbActive < dbMax * 0.8,
  };

  return NextResponse.json({
    ok: true,
    stats,
    health,
    recentTenants: recentTenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      type: t.type,
      tier: t.tier,
      region: t.region,
      users: t.userCount,
      storage: formatStorage(t.storageBytes),
      joined: formatJoined(new Date(t.createdAt)),
      initials: initialsFor(t.name),
    })),
    incidents: incidents.map((i) => ({
      id: i.id,
      number: `INC-${String(i.number).padStart(4, "0")}`,
      title: i.title,
      severity: i.severity,
      status: i.status,
      scope: i.scope,
      timeLabel: relTime(new Date(i.openedAt)),
    })),
    platformConfig: {
      enabledFlags: configCounts?.enabled_flags ?? 0,
      tierCount: configCounts?.tier_count ?? 0,
      roleCount: configCounts?.role_count ?? 0,
      regionCount: configCounts?.region_count ?? 0,
    },
  });
}
