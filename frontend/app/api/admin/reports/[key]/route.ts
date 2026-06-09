import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ReportPayload, ReportSection, ReportStat } from "@/lib/report-types";

export const runtime = "nodejs";

/**
 * Org Admin per-report data endpoint.
 *
 * GET /api/admin/reports/[key]
 *
 * Returns a `ReportPayload` (shared shape with `/api/auditor/reports/[key]`)
 * populated with LIVE tenant-scoped data, so the PDF renderer can build the
 * same layout from real numbers instead of the hardcoded literals in
 * lib/report-generators.ts.
 *
 * Supported keys: appointment_summary, user_activity, audit_summary,
 * compliance_summary (used for the "Department load" card on /admin/reports).
 */

const VALID_KEYS = new Set([
  "appointment_summary",
  "user_activity",
  "audit_summary",
  "compliance_summary",
]);

function fmtIst(d: Date): string {
  return d.toLocaleString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" });
}
function fmtIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function pct(num: number, denom: number, digits = 1): string {
  if (denom <= 0) return "0%";
  return `${((num / denom) * 100).toFixed(digits)}%`;
}
function relFromNow(iso: Date | null): string {
  if (!iso) return "never";
  const ms = Date.now() - iso.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!VALID_KEYS.has(key)) {
    return NextResponse.json({ ok: false, error: "Unknown report key." }, { status: 404 });
  }

  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  if (claims.role !== "Org Admin") {
    return NextResponse.json(
      { ok: false, error: "Forbidden — Org Admin only." },
      { status: 403 },
    );
  }
  if (!claims.org) {
    return NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 });
  }

  try {
    const [org] = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name FROM organizations WHERE slug = ${claims.org} LIMIT 1
    `;
    if (!org) {
      return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sections: ReportSection[] = [];
    let title = "";
    let description = "";

    if (key === "appointment_summary") {
      title = "Appointment Summary";
      description = "Volume per clinician, no-show rate, and completion stats.";

      const [agg] = await prisma.$queryRaw<
        { total: number; completed: number; no_show: number; cancelled: number; rescheduled: number }[]
      >`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'completed'::"AppointmentStatus")::int AS completed,
          COUNT(*) FILTER (WHERE status = 'no_show'::"AppointmentStatus")::int AS no_show,
          COUNT(*) FILTER (WHERE status = 'cancelled'::"AppointmentStatus")::int AS cancelled,
          COUNT(*) FILTER (WHERE status = 'reschedule_requested'::"AppointmentStatus")::int AS rescheduled
        FROM appointments
        WHERE "organizationId" = ${org.id}::uuid
          AND "createdAt" >= NOW() - INTERVAL '30 days'
      `;

      const stats: ReportStat[] = [
        { label: "Total appts", value: String(agg?.total ?? 0) },
        {
          label: "Completed",
          value: String(agg?.completed ?? 0),
          sub: pct(agg?.completed ?? 0, agg?.total ?? 0),
        },
        {
          label: "No-shows",
          value: String(agg?.no_show ?? 0),
          sub: pct(agg?.no_show ?? 0, agg?.total ?? 0),
        },
        { label: "Cancelled", value: String(agg?.cancelled ?? 0) },
      ];
      sections.push({ kind: "stats", heading: "30-day summary", stats });

      // Per-clinician breakdown
      const perClinician = await prisma.$queryRaw<
        {
          clinicianId: string;
          firstName: string | null;
          lastName: string | null;
          designation: string | null;
          department: string | null;
          total: number;
          completed: number;
          no_show: number;
        }[]
      >`
        SELECT
          a."clinicianId",
          u."firstName", u."lastName", u.designation, u.department,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE a.status = 'completed'::"AppointmentStatus")::int AS completed,
          COUNT(*) FILTER (WHERE a.status = 'no_show'::"AppointmentStatus")::int AS no_show
        FROM appointments a
        LEFT JOIN users u ON u.id = a."clinicianId"
        WHERE a."organizationId" = ${org.id}::uuid
          AND a."createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY a."clinicianId", u."firstName", u."lastName", u.designation, u.department
        ORDER BY total DESC
        LIMIT 20
      `;
      sections.push({
        kind: "table",
        heading: "Per-clinician breakdown (last 30 days)",
        columns: ["Clinician", "Specialty / Dept", "Appts", "Completed", "No-show", "Utilization"],
        rows: perClinician.map((c) => {
          const name = c.firstName || c.lastName ? `Dr. ${(c.firstName ?? "").trim()} ${(c.lastName ?? "").trim()}`.trim() : "Unknown";
          const specialty = c.designation || c.department || "—";
          return [
            name,
            specialty,
            c.total,
            c.completed,
            c.no_show,
            pct(c.completed, c.total, 0),
          ];
        }),
        empty: "No appointments in the last 30 days.",
      });
    } else if (key === "user_activity") {
      title = "User Activity";
      description = "Logins, MFA enrollment, and last-activity per staff user.";

      const rows = await prisma.$queryRaw<
        {
          email: string;
          firstName: string;
          lastName: string;
          roleKind: string;
          department: string | null;
          mfaEnrolledAt: Date | null;
          lastActiveAt: Date | null;
          loginsLast30d: number;
        }[]
      >`
        SELECT
          u.email, u."firstName", u."lastName", u."roleKind"::text AS "roleKind",
          u.department, u."mfaEnrolledAt", u."lastActiveAt",
          (SELECT COUNT(*)::int FROM sessions s
            WHERE s."userId" = u.id AND s."issuedAt" >= NOW() - INTERVAL '30 days') AS "loginsLast30d"
        FROM users u
        WHERE u."organizationId" = ${org.id}::uuid
          AND u."deletedAt" IS NULL
          AND u."roleKind" <> 'patient'::"RoleKind"
        ORDER BY u."lastActiveAt" DESC NULLS LAST
        LIMIT 50
      `;

      const enrolled = rows.filter((r) => r.mfaEnrolledAt).length;
      sections.push({
        kind: "stats",
        heading: "Overview",
        stats: [
          { label: "Staff", value: String(rows.length) },
          { label: "MFA enrolled", value: String(enrolled), sub: pct(enrolled, rows.length) },
          {
            label: "Active in 30d",
            value: String(rows.filter((r) => r.lastActiveAt && r.lastActiveAt >= windowStart).length),
          },
        ],
      });

      sections.push({
        kind: "table",
        heading: "Staff overview",
        columns: ["User", "Role", "Department", "MFA", "Logins / 30d", "Last activity"],
        rows: rows.map((r) => [
          `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || r.email,
          r.roleKind.replace(/_/g, " "),
          r.department ?? "—",
          r.mfaEnrolledAt ? "TOTP" : "Pending",
          r.loginsLast30d,
          relFromNow(r.lastActiveAt),
        ]),
        empty: "No staff users.",
      });
    } else if (key === "audit_summary") {
      title = "Storage & Event Summary";
      description = "Document storage by category + audit event volumes.";

      const [storage] = await prisma.$queryRaw<
        { docs: number; bytes: bigint }[]
      >`
        SELECT
          COUNT(*)::int AS docs,
          COALESCE(SUM("sizeBytes"), 0)::bigint AS bytes
        FROM patient_documents
        WHERE "organizationId" = ${org.id}::uuid AND "deletedAt" IS NULL
      `;
      const bytes = Number(storage?.bytes ?? 0);
      sections.push({
        kind: "stats",
        heading: "Storage",
        stats: [
          { label: "Documents", value: String(storage?.docs ?? 0) },
          {
            label: "Total size",
            value:
              bytes >= 1024 * 1024
                ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
                : `${(bytes / 1024).toFixed(1)} KB`,
          },
        ],
      });

      const perCategory = await prisma.$queryRaw<
        { category: string; n: number; bytes: bigint }[]
      >`
        SELECT category, COUNT(*)::int AS n, COALESCE(SUM("sizeBytes"), 0)::bigint AS bytes
        FROM patient_documents
        WHERE "organizationId" = ${org.id}::uuid AND "deletedAt" IS NULL
        GROUP BY category
        ORDER BY bytes DESC
      `;
      sections.push({
        kind: "table",
        heading: "By document category",
        columns: ["Category", "Documents", "Total size"],
        rows: perCategory.map((c) => {
          const b = Number(c.bytes);
          return [
            c.category || "(uncategorised)",
            c.n,
            b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(1)} KB`,
          ];
        }),
        empty: "No documents on file.",
      });

      const [events] = await prisma.$queryRaw<
        { audit: number; messages: number; sessions: number; mfa: number }[]
      >`
        SELECT
          (SELECT COUNT(*)::int FROM appointment_audit_log
            WHERE "organizationId" = ${org.id}::uuid
              AND "createdAt" >= NOW() - INTERVAL '30 days') AS audit,
          (SELECT COUNT(*)::int FROM messages
            WHERE "organizationId" = ${org.id}::uuid
              AND "sentAt" >= NOW() - INTERVAL '30 days') AS messages,
          (SELECT COUNT(*)::int FROM sessions s
            JOIN users u ON u.id = s."userId"
            WHERE u."organizationId" = ${org.id}::uuid
              AND s."issuedAt" >= NOW() - INTERVAL '30 days') AS sessions,
          (SELECT COUNT(*)::int FROM mfa_challenges m
            JOIN users u ON u.id = m."userId"
            WHERE u."organizationId" = ${org.id}::uuid
              AND m."issuedAt" >= NOW() - INTERVAL '30 days') AS mfa
      `;
      sections.push({
        kind: "table",
        heading: "Audit event volume (last 30 days)",
        columns: ["Event category", "Count"],
        rows: [
          ["Appointment lifecycle changes", events?.audit ?? 0],
          ["Messages sent", events?.messages ?? 0],
          ["Login sessions issued", events?.sessions ?? 0],
          ["MFA challenges", events?.mfa ?? 0],
        ],
      });
    } else {
      // compliance_summary — repurposed on /admin/reports as "Department load"
      title = "Department Load";
      description = "Utilization, staff count, and patient panel size per department.";

      const departments = await prisma.$queryRaw<
        { id: string; name: string; staff: number; patients: number; appts30d: number }[]
      >`
        SELECT
          d.id, d.name,
          (SELECT COUNT(*)::int FROM users u
            WHERE u."organizationId" = ${org.id}::uuid
              AND u.department = d.name
              AND u."deletedAt" IS NULL) AS staff,
          (SELECT COUNT(DISTINCT pa."patientId")::int FROM patient_assignments pa
            JOIN users c ON c.id = pa."clinicianId"
            WHERE c.department = d.name
              AND pa."endedAt" IS NULL) AS patients,
          (SELECT COUNT(*)::int FROM appointments a
            JOIN users c ON c.id = a."clinicianId"
            WHERE c.department = d.name
              AND a."organizationId" = ${org.id}::uuid
              AND a."createdAt" >= NOW() - INTERVAL '30 days') AS appts30d
        FROM departments d
        WHERE d."organizationId" = ${org.id}::uuid
        ORDER BY appts30d DESC, d.name ASC
      `;
      sections.push({
        kind: "stats",
        heading: "Overview",
        stats: [
          { label: "Departments", value: String(departments.length) },
          {
            label: "Total staff",
            value: String(departments.reduce((s, d) => s + d.staff, 0)),
          },
          {
            label: "Appts / 30d",
            value: String(departments.reduce((s, d) => s + d.appts30d, 0)),
          },
        ],
      });

      sections.push({
        kind: "table",
        heading: "Per-department breakdown",
        columns: ["Department", "Staff", "Patients (active)", "Appts / 30d"],
        rows: departments.map((d) => [d.name, d.staff, d.patients, d.appts30d]),
        empty: "No departments configured yet.",
      });
    }

    const payload: ReportPayload = {
      key,
      title,
      description,
      generatedAt: now.toISOString(),
      generatedAtLabel: fmtIst(now),
      windowStart: fmtIsoDay(windowStart),
      windowEnd: fmtIsoDay(now),
      sections,
    };

    return NextResponse.json({
      ok: true,
      payload,
      tenant: { name: org.name, slug: claims.org },
      generatedBy: claims.email,
    });
  } catch (err) {
    console.error(`[admin reports ${key}] failed:`, err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
