import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/super/security
 *
 * Cross-tenant platform security feed for the Super Admin. UNIONs multiple
 * event-bearing tables — every row carries a tenant slug, a normalized event
 * type, a detail string, a severity, and a timestamp. Sources:
 *   • anomaly_decisions          → event type derived from signature prefix
 *   • mfa_challenges (failed)    → 'mfa.lockout'
 *   • users.lockedUntil          → 'account.lockout'
 *   • users.mfaEnrolledAt        → 'passkey.enroll'
 *   • incidents                  → 'incident.open' / 'incident.investigate'
 *
 * Returns up to 100 events newest-first plus 4 stat counters. No PHI is
 * surfaced — only counts, signature prefixes, and tenant slugs.
 */

interface RawEvent {
  source: string;
  occurredAt: Date;
  tenantSlug: string | null;
  eventType: string;
  severity: string;
  detail: string;
  scope: string | null;
}

// Map an anomaly_decisions signature prefix to a (type, severity) pair
// matching the security-stream vocabulary used on the page.
const SIG_PREFIX: Record<string, { type: string; severity: string }> = {
  bulkUpload: { type: "anomaly.flag", severity: "medium" },
  failedMFA: { type: "mfa.lockout", severity: "medium" },
  offHoursAccess: { type: "anomaly.flag", severity: "medium" },
  lockedAccount: { type: "account.lockout", severity: "medium" },
  bruteForce: { type: "auth.brute_force", severity: "high" },
  infectedUpload: { type: "malware.detected", severity: "high" },
  consentRevokedAccess: { type: "policy.violation", severity: "high" },
  unassignedPatient: { type: "policy.violation", severity: "medium" },
  excessiveViews: { type: "anomaly.flag", severity: "medium" },
  breakGlass: { type: "break_glass.start", severity: "high" },
  unusualIp: { type: "ip.unusual", severity: "medium" },
};

function utcLabel(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC`;
}

function compactCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
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

  // ─── Source 1: anomaly_decisions (cross-tenant) ─────────────────────────
  const anomalies = await prisma.$queryRaw<
    {
      id: string;
      signature: string;
      status: string;
      createdAt: Date;
      slug: string | null;
    }[]
  >`
    SELECT a.id, a.signature, a.status, a."createdAt", o.slug
    FROM anomaly_decisions a
    LEFT JOIN organizations o ON o.id = a."organizationId"
    WHERE a."createdAt" >= NOW() - INTERVAL '7 days'
    ORDER BY a."createdAt" DESC
    LIMIT 60
  `;

  // ─── Source 2: failed MFA attempts in last 7 days ───────────────────────
  const failedMfa = await prisma.$queryRaw<
    {
      id: string;
      issuedAt: Date;
      ipAddress: string | null;
      attemptsLeft: number;
      slug: string | null;
    }[]
  >`
    SELECT m.id, m."issuedAt", m."ipAddress", m."attemptsLeft", o.slug
    FROM mfa_challenges m
    LEFT JOIN users u ON u.id = m."userId"
    LEFT JOIN organizations o ON o.id = u."organizationId"
    WHERE m."issuedAt" >= NOW() - INTERVAL '7 days'
      AND m."usedAt" IS NULL
      AND (m."expiresAt" < NOW() OR m."attemptsLeft" = 0)
    ORDER BY m."issuedAt" DESC
    LIMIT 30
  `;

  // ─── Source 3: users currently locked (account.lockout events) ──────────
  const lockouts = await prisma.$queryRaw<
    {
      id: string;
      lockedUntil: Date;
      failedLoginCount: number;
      slug: string | null;
    }[]
  >`
    SELECT u.id, u."lockedUntil", u."failedLoginCount", o.slug
    FROM users u
    LEFT JOIN organizations o ON o.id = u."organizationId"
    WHERE u."lockedUntil" IS NOT NULL
      AND u."lockedUntil" >= NOW() - INTERVAL '7 days'
    ORDER BY u."lockedUntil" DESC
    LIMIT 20
  `;

  // ─── Source 4: recent MFA enrollments (passkey.enroll-ish events) ──────
  const enrollments = await prisma.$queryRaw<
    {
      id: string;
      mfaEnrolledAt: Date;
      email: string;
      slug: string | null;
    }[]
  >`
    SELECT u.id, u."mfaEnrolledAt", u.email, o.slug
    FROM users u
    LEFT JOIN organizations o ON o.id = u."organizationId"
    WHERE u."mfaEnrolledAt" IS NOT NULL
      AND u."mfaEnrolledAt" >= NOW() - INTERVAL '7 days'
    ORDER BY u."mfaEnrolledAt" DESC
    LIMIT 20
  `;

  // ─── Source 5: incidents (platform + tenant-scoped) ─────────────────────
  const incidents = await prisma.$queryRaw<
    {
      id: string;
      number: number;
      title: string;
      severity: string;
      status: string;
      scope: string | null;
      openedAt: Date;
    }[]
  >`
    SELECT id, number, title, severity, status, scope, "openedAt"
    FROM incidents
    WHERE "openedAt" >= NOW() - INTERVAL '7 days'
    ORDER BY "openedAt" DESC
    LIMIT 20
  `;

  // ─── Normalize all sources into a single feed ───────────────────────────
  const events: RawEvent[] = [];

  for (const a of anomalies) {
    const prefix = a.signature.split(":")[0];
    const meta = SIG_PREFIX[prefix] ?? { type: prefix, severity: "medium" };
    let detail: string;
    switch (prefix) {
      case "bulkUpload":
        detail = `Bulk download / upload pattern detected · ${a.status}`;
        break;
      case "failedMFA":
        detail = `Repeated MFA failures for one user · ${a.status}`;
        break;
      case "offHoursAccess":
        detail = `PHI access outside 08:00–18:00 working window · ${a.status}`;
        break;
      case "lockedAccount":
        detail = `Account auto-locked after consecutive failures · ${a.status}`;
        break;
      case "bruteForce":
        detail = `Sustained brute-force attempt blocked · ${a.status}`;
        break;
      case "infectedUpload":
        detail = `Document upload flagged as infected · ${a.status}`;
        break;
      case "breakGlass":
        detail = `User elevated for incident response · ${a.status}`;
        break;
      case "unusualIp":
        detail = `Sign-in from previously unseen IP · ${a.status}`;
        break;
      case "consentRevokedAccess":
        detail = `Access attempted after consent revocation · ${a.status}`;
        break;
      case "unassignedPatient":
        detail = `Clinician accessed unassigned patient · ${a.status}`;
        break;
      case "excessiveViews":
        detail = `Single clinician viewed many distinct records · ${a.status}`;
        break;
      default:
        detail = `${a.signature} · ${a.status}`;
    }
    events.push({
      source: "anomaly_decisions",
      occurredAt: new Date(a.createdAt),
      tenantSlug: a.slug,
      eventType: meta.type,
      severity: meta.severity,
      detail,
      scope: null,
    });
  }

  for (const m of failedMfa) {
    events.push({
      source: "mfa_challenges",
      occurredAt: new Date(m.issuedAt),
      tenantSlug: m.slug,
      eventType: "mfa.failure",
      severity: m.attemptsLeft === 0 ? "high" : "medium",
      detail:
        m.attemptsLeft === 0
          ? `MFA exhausted (0 attempts left)${m.ipAddress ? ` · ${m.ipAddress}` : ""}`
          : `MFA code expired without verification${m.ipAddress ? ` · ${m.ipAddress}` : ""}`,
      scope: null,
    });
  }

  for (const u of lockouts) {
    events.push({
      source: "users.lockedUntil",
      occurredAt: new Date(u.lockedUntil),
      tenantSlug: u.slug,
      eventType: "account.lockout",
      severity: "medium",
      detail: `Account locked after ${u.failedLoginCount} failures · auto-unlock at ${utcLabel(new Date(u.lockedUntil))}`,
      scope: null,
    });
  }

  for (const u of enrollments) {
    events.push({
      source: "users.mfaEnrolledAt",
      occurredAt: new Date(u.mfaEnrolledAt),
      tenantSlug: u.slug,
      eventType: "mfa.enroll",
      severity: "info",
      detail: `MFA / authenticator enrolled · ${u.email}`,
      scope: null,
    });
  }

  for (const i of incidents) {
    events.push({
      source: "incidents",
      occurredAt: new Date(i.openedAt),
      tenantSlug: null,
      eventType: i.status === "open" ? "incident.open" : `incident.${i.status}`,
      severity: i.severity === "high" ? "high" : i.severity === "medium" ? "medium" : "info",
      detail: `INC-${String(i.number).padStart(4, "0")} · ${i.title}`,
      scope: i.scope ?? "platform",
    });
  }

  // Sort newest-first and trim to 100
  events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const feed = events.slice(0, 100);

  // ─── Counters ───────────────────────────────────────────────────────────
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const last24h = feed.filter((e) => now - e.occurredAt.getTime() <= day);
  const events24h = last24h.length;
  const highSeverity24h = last24h.filter((e) => e.severity === "high").length;
  const activeBreakGlass = feed.filter(
    (e) => e.eventType === "break_glass.start" && now - e.occurredAt.getTime() <= day,
  ).length;
  const [blockedIpsRow] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(DISTINCT "ipAddress")::int AS n
    FROM mfa_challenges
    WHERE "issuedAt" >= NOW() - INTERVAL '24 hours'
      AND "attemptsLeft" = 0
      AND "ipAddress" IS NOT NULL
  `;

  return NextResponse.json({
    ok: true,
    stats: {
      events24h,
      events24hDisplay: compactCount(events24h),
      highSeverity24h,
      activeBreakGlass,
      blockedIps: blockedIpsRow?.n ?? 0,
    },
    events: feed.map((e) => ({
      time: utcLabel(e.occurredAt),
      tenant: e.tenantSlug ?? e.scope ?? "platform",
      eventType: e.eventType,
      detail: e.detail,
      severity: e.severity,
      iso: e.occurredAt.toISOString(),
    })),
  });
}
