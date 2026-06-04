import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mailerConfigured } from "@/lib/mail";

export const runtime = "nodejs";

/**
 * GET /api/super/health
 *
 * Real-service health probe for the Super Admin's Health & Status page.
 * Each "service" panel here is backed by a check that can actually fail:
 *
 *   - API · /v1       → just-served-this-response signal (always healthy at GET time)
 *                       Latency = measured wall-time of this handler.
 *   - PostgreSQL      → `SELECT 1` round-trip + `pg_postmaster_start_time()`
 *                       uptime derived from process start.
 *   - Worker          → pending background work (re_consent_responses pending +
 *                       unread messages older than 24h) as a queue-depth proxy.
 *   - S3 storage      → AWS_* env presence check + count of stored documents.
 *   - SendGrid (Email)→ `mailerConfigured()` from lib/mail.ts (Resend / SMTP /
 *                       SendGrid SDK key).
 *   - Twilio SMS      → TWILIO_* env presence.
 *
 * Maintenance windows: pulled from `incidents` rows whose title or scope
 * matches a maintenance pattern (status = 'monitoring'). Empty state if none.
 */

interface ServiceOut {
  key: string;
  name: string;
  icon: "server" | "activity" | "database" | "harddrive" | "mail" | "message";
  uptime: string; // "99.96%"
  uptimePct: number; // 99.96
  latencyMs: number | null;
  status: "healthy" | "degraded" | "down" | "not_configured";
  detail?: string;
}

function pctLabel(n: number): string {
  return `${n.toFixed(n >= 99.99 ? 0 : 2)}%`;
}

function relTimeUtc(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

function maintenanceLabel(d: Date): string {
  return `${d.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "UTC" })} · ${relTimeUtc(d)}`;
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

  const tStart = Date.now();

  // ─── PostgreSQL probe ───────────────────────────────────────────────────
  const dbStart = Date.now();
  let pgLatency = 0;
  let pgUptimeDays = 0;
  let pgOk = true;
  try {
    const r = await prisma.$queryRaw<{ uptime_seconds: number }[]>`
      SELECT EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time()))::int AS uptime_seconds
    `;
    pgLatency = Date.now() - dbStart;
    pgUptimeDays = Math.floor((r[0]?.uptime_seconds ?? 0) / 86_400);
  } catch {
    pgOk = false;
    pgLatency = Date.now() - dbStart;
  }

  // ─── Counts that drive Worker + S3 services ────────────────────────────
  const [counts] = pgOk
    ? await prisma.$queryRaw<
        {
          pending_reconsents: number;
          unread_stale: number;
          documents: number;
          documents_bytes: bigint | null;
        }[]
      >`
        SELECT
          (SELECT COUNT(*)::int FROM re_consent_responses WHERE response = 'pending') AS pending_reconsents,
          (SELECT COUNT(*)::int FROM messages WHERE "readAt" IS NULL AND "sentAt" < NOW() - INTERVAL '24 hours') AS unread_stale,
          (SELECT COUNT(*)::int FROM patient_documents WHERE "deletedAt" IS NULL) AS documents,
          (SELECT COALESCE(SUM("sizeBytes"), 0)::bigint FROM patient_documents WHERE "deletedAt" IS NULL) AS documents_bytes
      `
    : [{ pending_reconsents: 0, unread_stale: 0, documents: 0, documents_bytes: 0n }];

  // ─── Incidents (drive uptime % per service + banner + maintenance) ────
  const incidents = pgOk
    ? await prisma.$queryRaw<
        {
          id: string;
          number: number;
          title: string;
          severity: string;
          status: string;
          scope: string | null;
          openedAt: Date;
          resolvedAt: Date | null;
        }[]
      >`
        SELECT id, number, title, severity, status, scope, "openedAt", "resolvedAt"
        FROM incidents
        WHERE "openedAt" >= NOW() - INTERVAL '30 days'
        ORDER BY "openedAt" DESC
      `
    : [];

  // Compute downtime minutes in the last 30 days per scope. Default uptime = 100.
  const WINDOW_MIN = 30 * 24 * 60;
  function uptimeFor(matchScope: (scope: string | null, title: string) => boolean): number {
    let downtimeMin = 0;
    for (const i of incidents) {
      if (!matchScope(i.scope ?? "", i.title)) continue;
      const end = i.resolvedAt ? new Date(i.resolvedAt).getTime() : Date.now();
      const start = new Date(i.openedAt).getTime();
      downtimeMin += Math.max(0, (end - start) / 60_000);
    }
    if (downtimeMin <= 0) return 100;
    const pct = ((WINDOW_MIN - downtimeMin) / WINDOW_MIN) * 100;
    return Math.max(0, Math.min(100, Number(pct.toFixed(2))));
  }

  // ─── Service health probes ──────────────────────────────────────────────
  const apiUptime = uptimeFor((s, t) => s === "platform" || t.toLowerCase().includes("api"));
  const pgUptime = pgOk
    ? uptimeFor((s, t) => t.toLowerCase().includes("database") || t.toLowerCase().includes("postgres"))
    : 0;
  const workerUptime = uptimeFor((s, t) => t.toLowerCase().includes("worker") || t.toLowerCase().includes("queue"));
  const s3HasEnv =
    Boolean(process.env.AWS_S3_BUCKET || process.env.S3_BUCKET) &&
    Boolean(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_REGION);
  const s3Uptime = uptimeFor((s, t) => t.toLowerCase().includes("storage") || t.toLowerCase().includes("s3"));
  const mailOk = mailerConfigured();
  const mailUptime = uptimeFor((s, t) => t.toLowerCase().includes("email") || t.toLowerCase().includes("sendgrid") || t.toLowerCase().includes("smtp"));
  const smsOk = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM,
  );
  const smsUptime = uptimeFor((s, t) => t.toLowerCase().includes("sms") || t.toLowerCase().includes("twilio"));

  const apiLatency = Date.now() - tStart;

  const pendingJobs = (counts?.pending_reconsents ?? 0) + (counts?.unread_stale ?? 0);
  const docCount = counts?.documents ?? 0;
  const docBytes = counts?.documents_bytes ? Number(counts.documents_bytes) : 0;

  const services: ServiceOut[] = [
    {
      key: "api",
      name: "API · /v1",
      icon: "server",
      uptime: pctLabel(apiUptime),
      uptimePct: apiUptime,
      latencyMs: apiLatency,
      status: apiLatency < 1500 ? "healthy" : "degraded",
      detail: `Measured round-trip of this handler · ${apiLatency} ms`,
    },
    {
      key: "worker",
      name: "Worker (background jobs)",
      icon: "activity",
      uptime: pctLabel(workerUptime),
      uptimePct: workerUptime,
      latencyMs: null,
      status: pendingJobs < 1000 ? "healthy" : "degraded",
      detail: `${pendingJobs.toLocaleString("en-IN")} pending background items (re-consent + stale unread)`,
    },
    {
      key: "postgres",
      name: "PostgreSQL primary",
      icon: "database",
      uptime: pctLabel(pgUptime),
      uptimePct: pgUptime,
      latencyMs: pgOk ? pgLatency : null,
      status: !pgOk ? "down" : pgLatency < 200 ? "healthy" : "degraded",
      detail: pgOk ? `Process uptime ${pgUptimeDays}d · SELECT 1 in ${pgLatency} ms` : "Could not reach database.",
    },
    {
      key: "s3",
      name: "S3 storage",
      icon: "harddrive",
      uptime: s3HasEnv ? pctLabel(s3Uptime) : "—",
      uptimePct: s3HasEnv ? s3Uptime : 0,
      latencyMs: null,
      status: s3HasEnv ? "healthy" : "not_configured",
      detail: s3HasEnv
        ? `${docCount.toLocaleString("en-IN")} documents · ${(docBytes / 1024 / 1024).toFixed(1)} MB`
        : `Not configured · ${docCount.toLocaleString("en-IN")} documents stored as base64 dataUrl`,
    },
    {
      key: "email",
      name: "Email (SendGrid / SMTP / Resend)",
      icon: "mail",
      uptime: mailOk ? pctLabel(mailUptime) : "—",
      uptimePct: mailOk ? mailUptime : 0,
      latencyMs: null,
      status: mailOk ? "healthy" : "not_configured",
      detail: mailOk ? "Mailer transport configured" : "No mailer transport configured (SENDGRID_API_KEY / SMTP_* / RESEND_API_KEY)",
    },
    {
      key: "sms",
      name: "Twilio SMS",
      icon: "message",
      uptime: smsOk ? pctLabel(smsUptime) : "—",
      uptimePct: smsOk ? smsUptime : 0,
      latencyMs: null,
      status: smsOk ? "healthy" : "not_configured",
      detail: smsOk ? "TWILIO_* secrets present" : "Not configured (TWILIO_ACCOUNT_SID / AUTH_TOKEN / FROM missing)",
    },
  ];

  // ─── Banner status ──────────────────────────────────────────────────────
  const anyDown = services.some((s) => s.status === "down");
  const anyDegraded = services.some((s) => s.status === "degraded");
  const degradedNames = services
    .filter((s) => s.status === "degraded" || s.status === "down")
    .map((s) => s.name);
  const banner = {
    level: (anyDown ? "down" : anyDegraded ? "degraded" : "healthy") as
      | "down"
      | "degraded"
      | "healthy",
    title: anyDown
      ? "Critical service down"
      : anyDegraded
        ? "Minor service degradation detected"
        : "All critical services nominal",
    sub:
      degradedNames.length > 0
        ? `Degraded: ${degradedNames.join(" · ")}.`
        : `Last probe at ${relTimeUtc(new Date())} · ${incidents.filter((i) => i.status !== "resolved").length} open incident(s) on file.`,
  };

  // ─── Maintenance windows (from incidents whose title looks like maintenance) ─
  const maintenance = incidents
    .filter(
      (i) =>
        i.status === "monitoring" ||
        /maintenance|upgrade|rotation|patching/i.test(i.title),
    )
    .slice(0, 5)
    .map((i) => ({
      id: i.id,
      region: i.scope ?? "platform",
      title: i.title,
      time: maintenanceLabel(new Date(i.openedAt)),
      status: i.status === "monitoring" ? "Scheduled" : "Tentative",
    }));

  return NextResponse.json({
    ok: true,
    banner,
    services,
    maintenance,
    probedAt: new Date().toISOString(),
  });
}
