import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Org Admin → /admin/reports backing endpoint.
 *
 * GET /api/admin/reports
 * Returns live operational metrics for the signed-in Org Admin's tenant:
 *  - apptCompletion / noShowRate (% from appointments in last 30 days)
 *  - storageGrowthBytes (sum of patient_documents.sizeBytes uploaded in last 30 days)
 *  - userMaus (distinct users.lastActiveAt in last 30 days) / userTotal (active users)
 *  - departmentCount (live count for the "Department load" report subtitle)
 *  - per-report `lastRunAt` for the 4 cards on the page (from report_exports)
 *
 * All counts are scoped to the caller's `organizations.slug == claims.org` —
 * no cross-tenant leakage.
 */

async function requireOrgAdmin() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  }
  if (claims.role !== "Org Admin") {
    return {
      error: NextResponse.json(
        { ok: false, error: "Forbidden — Org Admin only." },
        { status: 403 },
      ),
    };
  }
  if (!claims.org) {
    return { error: NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 }) };
  }
  return { claims };
}

const REPORT_KEYS = [
  "appointment_summary",
  "user_activity",
  "audit_summary",
  "compliance_summary",
] as const;
type ReportKey = (typeof REPORT_KEYS)[number];

function formatStorageGrowth(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B / mo";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const sign = bytes >= 0 ? "+" : "";
  return `${sign}${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]} / mo`;
}

function relTime(iso: Date | null): string {
  if (!iso) return "never run";
  const ms = Date.now() - iso.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

export async function GET() {
  const g = await requireOrgAdmin();
  if ("error" in g) return g.error;

  try {
    const [org] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM organizations WHERE slug = ${g.claims.org} LIMIT 1
    `;
    if (!org) {
      return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
    }
    const orgId = org.id;

    // ─── Stats — one round trip ────────────────────────────────────────
    const [stats] = await prisma.$queryRaw<
      {
        total_appts: number;
        completed_appts: number;
        no_show_appts: number;
        storage_growth_bytes: bigint;
        user_total: number;
        user_maus: number;
        department_count: number;
      }[]
    >`
      SELECT
        (SELECT COUNT(*)::int FROM appointments
          WHERE "organizationId" = ${orgId}::uuid
            AND "createdAt" >= NOW() - INTERVAL '30 days') AS total_appts,
        (SELECT COUNT(*)::int FROM appointments
          WHERE "organizationId" = ${orgId}::uuid
            AND "createdAt" >= NOW() - INTERVAL '30 days'
            AND status = 'completed'::"AppointmentStatus") AS completed_appts,
        (SELECT COUNT(*)::int FROM appointments
          WHERE "organizationId" = ${orgId}::uuid
            AND "createdAt" >= NOW() - INTERVAL '30 days'
            AND status = 'no_show'::"AppointmentStatus") AS no_show_appts,
        (SELECT COALESCE(SUM("sizeBytes"), 0)::bigint FROM patient_documents
          WHERE "organizationId" = ${orgId}::uuid
            AND "deletedAt" IS NULL
            AND "uploadedAt" >= NOW() - INTERVAL '30 days') AS storage_growth_bytes,
        (SELECT COUNT(*)::int FROM users
          WHERE "organizationId" = ${orgId}::uuid
            AND "deletedAt" IS NULL
            AND status = 'active'::"UserStatus") AS user_total,
        (SELECT COUNT(*)::int FROM users
          WHERE "organizationId" = ${orgId}::uuid
            AND "deletedAt" IS NULL
            AND "lastActiveAt" >= NOW() - INTERVAL '30 days') AS user_maus,
        (SELECT COUNT(*)::int FROM departments
          WHERE "organizationId" = ${orgId}::uuid) AS department_count
    `;

    const total = stats?.total_appts ?? 0;
    const completed = stats?.completed_appts ?? 0;
    const noShow = stats?.no_show_appts ?? 0;
    const apptCompletionPct = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;
    const noShowRatePct = total > 0 ? Number(((noShow / total) * 100).toFixed(1)) : 0;
    const storageGrowthBytes = stats?.storage_growth_bytes
      ? Number(stats.storage_growth_bytes)
      : 0;
    const userTotal = stats?.user_total ?? 0;
    const userMaus = stats?.user_maus ?? 0;
    const departmentCount = stats?.department_count ?? 0;

    // ─── Last-run per report key ───────────────────────────────────────
    const lastRunRows = await prisma.$queryRaw<
      { reportKey: string; lastRunAt: Date; userEmail: string | null }[]
    >`
      SELECT DISTINCT ON ("reportKey")
        "reportKey", "createdAt" AS "lastRunAt", "userEmail"
      FROM report_exports
      WHERE "organizationId" = ${orgId}::uuid
      ORDER BY "reportKey", "createdAt" DESC
    `;
    const byKey = new Map<string, { lastRunAt: Date; userEmail: string | null }>();
    for (const r of lastRunRows) {
      byKey.set(r.reportKey, { lastRunAt: r.lastRunAt, userEmail: r.userEmail });
    }

    const cards: Record<ReportKey, { lastRunAt: string | null; lastRunBy: string | null; lastRunRel: string }> =
      {} as never;
    for (const k of REPORT_KEYS) {
      const last = byKey.get(k);
      cards[k] = {
        lastRunAt: last ? last.lastRunAt.toISOString() : null,
        lastRunBy: last?.userEmail ?? null,
        lastRunRel: relTime(last?.lastRunAt ?? null),
      };
    }

    return NextResponse.json({
      ok: true,
      stats: {
        apptCompletionPct,
        apptCompletionLabel: `${apptCompletionPct}%`,
        noShowRatePct,
        noShowRateLabel: `${noShowRatePct}%`,
        storageGrowthBytes,
        storageGrowthLabel: formatStorageGrowth(storageGrowthBytes),
        userMaus,
        userTotal,
        userMausLabel: `${userMaus} / ${userTotal}`,
        departmentCount,
      },
      cards,
    });
  } catch (err) {
    console.error("[admin reports] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
