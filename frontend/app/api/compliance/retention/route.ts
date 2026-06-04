import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardCompliance } from "@/lib/compliance-guard";

export const runtime = "nodejs";

/**
 * GET /api/compliance/retention
 *
 * Powers the Compliance → Retention page in one call. Returns:
 *  - buckets        : per-tenant retention windows + live record counts pulled
 *                     from the actual content tables (medical_records,
 *                     patient_documents, messages, appointment_audit_log) so
 *                     numbers reflect this tenant instead of a fixture.
 *  - override       : the tenant's override row (pausePurge / legalHold +
 *                     last-changed-by metadata for the amber banner).
 *  - recentRequests : 3 most-recent patient export / deletion requests (used
 *                     by the small list on the retention page).
 *  - openRequests   : count of open requests (sidebar badge).
 *  - runs           : last 6 purge runs.
 *  - nextRunAt      : next 02:00 UTC run.
 *
 * Each tenant gets its retention_windows + retention_overrides rows
 * auto-seeded on first GET so the page is never blank.
 */

const DEFAULT_BUCKETS: { bucket: string; retentionLabel: string; deletionMode: string }[] = [
  { bucket: "medical_records", retentionLabel: "7 years", deletionMode: "scheduled" },
  { bucket: "documents", retentionLabel: "5 years", deletionMode: "scheduled" },
  { bucket: "messages", retentionLabel: "2 years", deletionMode: "scheduled" },
  { bucket: "audit_logs", retentionLabel: "6 years", deletionMode: "cold_tier_after_2y" },
  { bucket: "backups", retentionLabel: "30 days PITR", deletionMode: "rolling" },
];

const BUCKET_LABELS: Record<string, string> = {
  medical_records: "Medical records",
  documents: "Documents",
  messages: "Messages",
  audit_logs: "Audit logs",
  backups: "Backups",
};

const DELETION_MODE_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  cold_tier_after_2y: "Cold-tier after 2y",
  rolling: "Rolling",
  paused: "Paused",
};

interface BucketRow {
  bucket: string;
  retentionLabel: string;
  deletionMode: string;
}
interface OverrideRow {
  pausePurge: boolean;
  legalHold: boolean;
  lastChangedAt: Date | null;
  lastChangedByEmail: string | null;
  lastChangeReason: string | null;
  lastChangeIncidentRef: string | null;
}
interface PurgeRunRow {
  id: string;
  runAt: Date;
  result: string;
  recordsPurged: number;
  bytesPurged: bigint | number;
  categories: string[];
  durationMs: number;
  note: string | null;
}
interface RequestRow {
  id: string;
  patientName: string;
  patientMrn: string;
  patientEmail: string;
  type: string;
  status: string;
  channel: string;
  legalHold: boolean;
  legalHoldReason: string | null;
  decisionNote: string | null;
  decidedByEmail: string | null;
  decidedAt: Date | null;
  requestedAt: Date;
}

function formatBytes(n: bigint | number): string {
  const v = typeof n === "bigint" ? Number(n) : n;
  if (!Number.isFinite(v) || v <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let x = v;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(x >= 100 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Format a Date as "May 26, 2026 · 02:00 UTC" (UTC clock, IST locale for month names). */
function formatRunDate(d: Date): string {
  const base = d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${base} · ${hh}:${mm} UTC`;
}

/** Next 02:00 UTC after `now`. */
function nextDailyRun(now: Date): Date {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function compactCount(n: number, unit: string): string {
  if (!Number.isFinite(n) || n <= 0) return `0 ${unit}`;
  if (n < 1000) return `${n} ${unit}`;
  if (n < 1_000_000) {
    const v = (n / 1000).toFixed(1).replace(".0", "");
    return `${v}k ${unit}`;
  }
  const v = (n / 1_000_000).toFixed(1).replace(".0", "");
  return `${v}M ${unit}`;
}

async function ensureBuckets(orgId: string): Promise<BucketRow[]> {
  const existing = await prisma.$queryRaw<BucketRow[]>`
    SELECT bucket, "retentionLabel", "deletionMode"
    FROM retention_windows
    WHERE "organizationId" = ${orgId}::uuid
  `;
  const have = new Set(existing.map((b) => b.bucket));
  const missing = DEFAULT_BUCKETS.filter((b) => !have.has(b.bucket));
  for (const b of missing) {
    await prisma.$executeRaw`
      INSERT INTO retention_windows ("organizationId", bucket, "retentionLabel", "deletionMode")
      VALUES (${orgId}::uuid, ${b.bucket}, ${b.retentionLabel}, ${b.deletionMode})
      ON CONFLICT ("organizationId", bucket) DO NOTHING
    `;
  }
  if (missing.length > 0) {
    return prisma.$queryRaw<BucketRow[]>`
      SELECT bucket, "retentionLabel", "deletionMode"
      FROM retention_windows
      WHERE "organizationId" = ${orgId}::uuid
    `;
  }
  return existing;
}

async function ensureOverride(orgId: string): Promise<OverrideRow> {
  await prisma.$executeRaw`
    INSERT INTO retention_overrides ("organizationId", "pausePurge", "legalHold")
    VALUES (${orgId}::uuid, false, true)
    ON CONFLICT ("organizationId") DO NOTHING
  `;
  const rows = await prisma.$queryRaw<OverrideRow[]>`
    SELECT "pausePurge", "legalHold", "lastChangedAt", "lastChangedByEmail",
           "lastChangeReason", "lastChangeIncidentRef"
    FROM retention_overrides
    WHERE "organizationId" = ${orgId}::uuid
    LIMIT 1
  `;
  return rows[0];
}

interface Counts {
  medicalPatients: number;
  documents: number;
  messageThreads: number;
  auditEvents: number;
}

async function loadCounts(orgId: string): Promise<Counts> {
  const r = await prisma.$queryRaw<
    { medical_patients: number; documents: number; message_threads: number; audit_events: number }[]
  >`
    SELECT
      (SELECT COUNT(DISTINCT "patientId")::int FROM medical_records WHERE "organizationId" = ${orgId}::uuid AND "deletedAt" IS NULL) AS medical_patients,
      (SELECT COUNT(*)::int FROM patient_documents WHERE "organizationId" = ${orgId}::uuid AND "deletedAt" IS NULL) AS documents,
      (SELECT COUNT(DISTINCT ("clinicianId", "patientId"))::int FROM messages WHERE "organizationId" = ${orgId}::uuid) AS message_threads,
      (SELECT COUNT(*)::int FROM appointment_audit_log WHERE "organizationId" = ${orgId}::uuid) AS audit_events
  `;
  return {
    medicalPatients: r[0]?.medical_patients ?? 0,
    documents: r[0]?.documents ?? 0,
    messageThreads: r[0]?.message_threads ?? 0,
    auditEvents: r[0]?.audit_events ?? 0,
  };
}

function bucketCountLabel(bucket: string, c: Counts): string {
  switch (bucket) {
    case "medical_records":
      return c.medicalPatients === 1
        ? "1 patient"
        : `${c.medicalPatients.toLocaleString("en-IN")} patients`;
    case "documents":
      return compactCount(c.documents, c.documents === 1 ? "file" : "files");
    case "messages":
      return compactCount(c.messageThreads, c.messageThreads === 1 ? "thread" : "threads");
    case "audit_logs":
      return compactCount(c.auditEvents, "events");
    case "backups":
      return "Daily full";
    default:
      return "";
  }
}

export async function GET() {
  const g = await guardCompliance();
  if ("error" in g) return g.error;

  const [bucketRows, overrideRow, counts] = await Promise.all([
    ensureBuckets(g.orgId),
    ensureOverride(g.orgId),
    loadCounts(g.orgId),
  ]);

  const order = new Map(DEFAULT_BUCKETS.map((b, i) => [b.bucket, i]));
  const buckets = bucketRows
    .slice()
    .sort((a, b) => (order.get(a.bucket) ?? 99) - (order.get(b.bucket) ?? 99))
    .map((b) => ({
      key: b.bucket,
      name: BUCKET_LABELS[b.bucket] ?? b.bucket,
      retention: b.retentionLabel,
      deletion: DELETION_MODE_LABELS[b.deletionMode] ?? b.deletionMode,
      count: bucketCountLabel(b.bucket, counts),
    }));

  const runs = await prisma.$queryRaw<PurgeRunRow[]>`
    SELECT id, "runAt", result, "recordsPurged", "bytesPurged", categories, "durationMs", note
    FROM retention_purge_runs
    WHERE "organizationId" = ${g.orgId}::uuid
    ORDER BY "runAt" DESC
    LIMIT 6
  `;

  const recent = await prisma.$queryRaw<RequestRow[]>`
    SELECT id, "patientName", "patientMrn", "patientEmail", type, status, channel,
           "legalHold", "legalHoldReason", "decisionNote", "decidedByEmail", "decidedAt", "requestedAt"
    FROM patient_data_requests
    WHERE "organizationId" = ${g.orgId}::uuid
    ORDER BY "requestedAt" DESC
    LIMIT 3
  `;

  const openCounts = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM patient_data_requests
    WHERE "organizationId" = ${g.orgId}::uuid
      AND status IN ('pending','in_progress','blocked')
  `;

  return NextResponse.json({
    ok: true,
    buckets,
    override: {
      pausePurge: overrideRow.pausePurge,
      legalHold: overrideRow.legalHold,
      lastChangedAt: overrideRow.lastChangedAt ? overrideRow.lastChangedAt.toISOString() : null,
      lastChangedByEmail: overrideRow.lastChangedByEmail,
      lastChangeReason: overrideRow.lastChangeReason,
      lastChangeIncidentRef: overrideRow.lastChangeIncidentRef,
    },
    runs: runs.map((r) => ({
      id: r.id,
      runId: `purge-${r.runAt.toISOString().slice(0, 10)}`,
      date: formatRunDate(r.runAt),
      result: r.result,
      records: r.recordsPurged,
      bytes: formatBytes(r.bytesPurged),
      categories: r.categories,
      duration: formatDuration(r.durationMs),
      note: r.note,
    })),
    nextRunAt: formatRunDate(nextDailyRun(new Date())),
    recentRequests: recent.map((r) => ({
      id: r.id,
      patientName: r.patientName,
      patientMrn: r.patientMrn,
      patientEmail: r.patientEmail,
      type: r.type,
      status: r.status,
      channel: r.channel,
      legalHold: r.legalHold,
      legalHoldReason: r.legalHoldReason,
      decisionNote: r.decisionNote,
      decidedByEmail: r.decidedByEmail,
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      requestedAt: r.requestedAt.toISOString(),
    })),
    openRequestsCount: openCounts[0]?.n ?? 0,
  });
}

const VALID_BUCKETS = new Set(DEFAULT_BUCKETS.map((b) => b.bucket));

interface PatchBody {
  bucket?: string;
  retentionLabel?: string;
  deletionMode?: string;
}

/**
 * PATCH /api/compliance/retention
 * Adjust a single bucket's retention label / deletion mode. Compliance-only.
 */
export async function PATCH(req: Request) {
  const g = await guardCompliance();
  if ("error" in g) return g.error;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const bucket = (body.bucket ?? "").trim();
  const retentionLabel = (body.retentionLabel ?? "").trim();
  const deletionMode = (body.deletionMode ?? "").trim();

  if (!VALID_BUCKETS.has(bucket)) {
    return NextResponse.json({ ok: false, error: "Unknown bucket." }, { status: 400 });
  }
  if (!retentionLabel || retentionLabel.length > 32) {
    return NextResponse.json(
      { ok: false, error: "Retention label is required (max 32 chars)." },
      { status: 400 },
    );
  }
  if (deletionMode && !["scheduled", "cold_tier_after_2y", "rolling", "paused"].includes(deletionMode)) {
    return NextResponse.json({ ok: false, error: "Invalid deletion mode." }, { status: 400 });
  }

  const finalMode = deletionMode || "scheduled";

  await prisma.$executeRaw`
    INSERT INTO retention_windows ("organizationId", bucket, "retentionLabel", "deletionMode", "updatedAt")
    VALUES (${g.orgId}::uuid, ${bucket}, ${retentionLabel}, ${finalMode}, NOW())
    ON CONFLICT ("organizationId", bucket)
    DO UPDATE SET "retentionLabel" = EXCLUDED."retentionLabel",
                  "deletionMode" = EXCLUDED."deletionMode",
                  "updatedAt" = NOW()
  `;

  return NextResponse.json({ ok: true });
}
