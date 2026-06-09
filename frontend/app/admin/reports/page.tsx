"use client";

import { useEffect, useState } from "react";
import {
  Download,
  BarChart3,
  Calendar,
  Users,
  HardDrive,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ReportDownloadButton } from "@/components/shared/report-download-button";
import type { ReportKey } from "@/lib/report-generators";

type CardKey = "appointment_summary" | "user_activity" | "audit_summary" | "compliance_summary";

interface ReportCardMeta {
  key: CardKey;
  name: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ReportsPayload {
  stats: {
    apptCompletionPct: number;
    apptCompletionLabel: string;
    noShowRatePct: number;
    noShowRateLabel: string;
    storageGrowthBytes: number;
    storageGrowthLabel: string;
    userMaus: number;
    userTotal: number;
    userMausLabel: string;
    departmentCount: number;
  };
  cards: Record<
    CardKey,
    { lastRunAt: string | null; lastRunBy: string | null; lastRunRel: string }
  >;
}

export default function AdminReports() {
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/admin/reports", { cache: "no-store" });
        const j = (await r.json()) as ReportsPayload & { ok: boolean; error?: string };
        if (cancelled) return;
        if (!r.ok || !j.ok) {
          setError(j.error ?? "Could not load reports.");
          return;
        }
        setData(j);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader
          eyebrow="Reports"
          title="Operational reports"
          description="Org-scoped metrics. PHI access reports live in the Compliance Manager workspace."
        />
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading reports…
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          eyebrow="Reports"
          title="Operational reports"
          description="Org-scoped metrics. PHI access reports live in the Compliance Manager workspace."
        />
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-10 text-center text-sm text-[var(--color-danger)]">
          {error ?? "Reports unavailable."}
        </div>
      </>
    );
  }

  const { stats, cards } = data;

  // Card descriptors. Department-load description now references the live
  // department count instead of the hardcoded "7 departments".
  const REPORTS: ReportCardMeta[] = [
    {
      key: "appointment_summary",
      name: "Appointment summary",
      desc: "Volume per clinician, no-show breakdown",
      icon: Calendar,
    },
    {
      key: "user_activity",
      name: "User activity",
      desc: "Logins, actions, MFA enrollment",
      icon: Users,
    },
    {
      key: "audit_summary",
      name: "Storage & event summary",
      desc: "By bucket, by document category",
      icon: HardDrive,
    },
    {
      key: "compliance_summary",
      name: "Department load",
      desc:
        stats.departmentCount > 0
          ? `Utilization across ${stats.departmentCount} department${stats.departmentCount === 1 ? "" : "s"}`
          : "Utilization across departments",
      icon: BarChart3,
    },
  ];

  // Tile metadata — trend arrow comes from the live value itself, not a
  // hardcoded direction. No-show goes "down" when it's <5%, "up" otherwise.
  const tiles = [
    {
      label: "Appt completion",
      value: stats.apptCompletionLabel,
      trend: stats.apptCompletionPct >= 85 ? "up" : "down",
      icon: Calendar,
    },
    {
      label: "No-show rate",
      value: stats.noShowRateLabel,
      trend: stats.noShowRatePct <= 5 ? "down" : "up",
      icon: Users,
    },
    {
      label: "Storage growth",
      value: stats.storageGrowthLabel,
      trend: "up",
      icon: HardDrive,
    },
    {
      label: "User MAUs",
      value: stats.userMausLabel,
      trend: stats.userTotal > 0 && stats.userMaus / stats.userTotal >= 0.7 ? "up" : "down",
      icon: Users,
    },
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Operational reports"
        description="Org-scoped metrics. PHI access reports live in the Compliance Manager workspace."
        actions={
          <ReportDownloadButton
            report="appointment_summary"
            format="csv"
            size="sm"
            source="admin"
          >
            <Download /> Export CSV
          </ReportDownloadButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {tiles.map((s) => {
          const Icon = s.icon;
          const TrendIcon = s.trend === "up" ? TrendingUp : TrendingDown;
          // For the No-show tile, "down" trend is GOOD (lower is better).
          // For everything else, "up" is GOOD.
          const goodWhenDown = s.label === "No-show rate";
          const isGood = goodWhenDown ? s.trend === "down" : s.trend === "up";
          return (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted-foreground)]">
                <span className="inline-flex items-center gap-1.5">
                  <Icon className="size-3.5" /> {s.label}
                </span>
                <TrendIcon
                  className={`size-3.5 ${
                    isGood ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                  }`}
                />
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const lastRun = cards[r.key];
          return (
            <div
              key={r.name}
              className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-all hover:shadow-[var(--shadow-card)]"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 text-base font-semibold">{r.name}</h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">{r.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant="muted" size="sm">
                  {lastRun.lastRunAt
                    ? `Last run · ${lastRun.lastRunRel}${lastRun.lastRunBy ? " · " + lastRun.lastRunBy : ""}`
                    : "Never run"}
                </Badge>
                <div className="flex gap-1">
                  <ReportDownloadButton
                    report={r.key as ReportKey}
                    format="pdf"
                    variant="outline"
                    size="sm"
                    source="admin"
                  >
                    Run · PDF
                  </ReportDownloadButton>
                  <ReportDownloadButton
                    report={r.key as ReportKey}
                    format="csv"
                    variant="ghost"
                    size="sm"
                    aria-label="Download CSV"
                    source="admin"
                  >
                    <Download />
                  </ReportDownloadButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
