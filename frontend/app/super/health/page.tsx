"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Globe,
  Database,
  Server,
  Mail,
  MessageSquare,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";

/**
 * Super Admin → Platform health. Each service tile is fed by a real probe in
 * `/api/super/health` — uptime is computed from `incidents` rows in the last
 * 30 days, latency from actual wall-time measurements, and integration
 * status from env-var presence. No hardcoded values.
 */

type IconKey = "server" | "activity" | "database" | "harddrive" | "mail" | "message";
type Status = "healthy" | "degraded" | "down" | "not_configured";

interface ServiceItem {
  key: string;
  name: string;
  icon: IconKey;
  uptime: string;
  uptimePct: number;
  latencyMs: number | null;
  status: Status;
  detail?: string;
}

interface HealthPayload {
  banner: { level: "down" | "degraded" | "healthy"; title: string; sub: string };
  services: ServiceItem[];
  maintenance: { id: string; region: string; title: string; time: string; status: string }[];
  probedAt: string;
}

const ICON_MAP: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  server: Server,
  activity: Activity,
  database: Database,
  harddrive: HardDrive,
  mail: Mail,
  message: MessageSquare,
};

function StatusBadge({ status }: { status: Status }) {
  if (status === "healthy") return <Badge variant="success" size="sm" dot>Healthy</Badge>;
  if (status === "degraded") return <Badge variant="warning" size="sm" dot>Degraded</Badge>;
  if (status === "down") return <Badge variant="danger" size="sm" dot>Down</Badge>;
  return <Badge variant="muted" size="sm">Not configured</Badge>;
}

function BannerIcon({ level }: { level: HealthPayload["banner"]["level"] }) {
  if (level === "down") return <XCircle className="size-5" />;
  if (level === "degraded") return <AlertTriangle className="size-5" />;
  return <CheckCircle2 className="size-5" />;
}

export default function HealthPage() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/super/health", { cache: "no-store" });
        const j = (await r.json()) as HealthPayload & { ok: boolean; error?: string };
        if (!alive) return;
        if (!r.ok || !j.ok) {
          setError(j.error ?? "Could not load health probe.");
          return;
        }
        setData(j);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader
          eyebrow="Operations"
          title="Platform health"
          description="Real-time service status, latency, and uptime against SLOs."
        />
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Probing services…
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          eyebrow="Operations"
          title="Platform health"
          description="Real-time service status, latency, and uptime against SLOs."
        />
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-10 text-center text-sm text-[var(--color-danger)]">
          {error ?? "Health data unavailable."}
        </div>
      </>
    );
  }

  const { banner, services, maintenance } = data;
  const bannerClass =
    banner.level === "down"
      ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/30 text-[var(--color-danger)]"
      : banner.level === "degraded"
        ? "border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/30 text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]"
        : "border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/30 text-[var(--color-success)]";
  const bannerIconClass =
    banner.level === "down"
      ? "text-[var(--color-danger)] ring-[var(--color-danger)]/30"
      : banner.level === "degraded"
        ? "text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)] ring-[var(--color-warning)]/30"
        : "text-[var(--color-success)] ring-[var(--color-success)]/30";
  const bannerBadge =
    banner.level === "down" ? (
      <Badge variant="danger" size="sm" dot className="ml-auto">Down</Badge>
    ) : banner.level === "degraded" ? (
      <Badge variant="warning" size="sm" dot className="ml-auto">Degraded</Badge>
    ) : (
      <Badge variant="success" size="sm" dot className="ml-auto">Healthy</Badge>
    );

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Platform health"
        description="Real-time service status, latency, and uptime against SLOs."
      />

      <div className={`rounded-2xl border ${bannerClass} p-5`}>
        <div className="flex items-start gap-3">
          <span className={`flex size-10 items-center justify-center rounded-lg bg-[var(--color-card)] ring-1 ${bannerIconClass}`}>
            <BannerIcon level={banner.level} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--color-foreground)]">{banner.title}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">{banner.sub}</p>
          </div>
          {bannerBadge}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {services.map((s) => {
          const Icon = ICON_MAP[s.icon];
          const iconBg =
            s.status === "healthy"
              ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
              : s.status === "degraded"
                ? "bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]"
                : s.status === "down"
                  ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                  : "bg-[var(--color-muted)]/40 text-[var(--color-muted-foreground)]";
          const sub =
            s.status === "not_configured"
              ? s.detail ?? "Not configured"
              : `uptime ${s.uptime}${s.latencyMs != null ? ` · p95 latency ${s.latencyMs} ms` : ""}`;
          return (
            <div
              key={s.key}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`flex size-10 items-center justify-center rounded-xl ${iconBg}`}>
                    <Icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">{sub}</p>
                  </div>
                </div>
                <StatusBadge status={s.status} />
              </div>
              {s.status !== "not_configured" && (
                <Progress value={s.uptimePct} className="mt-4" />
              )}
              {s.detail && s.status !== "not_configured" && (
                <p className="mt-2 text-[10px] italic text-[var(--color-muted-foreground)]">
                  {s.detail}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <Clock className="size-4" /> Maintenance windows
        </h2>
        {maintenance.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-muted-foreground)]">
            No scheduled maintenance.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {maintenance.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3 text-xs"
              >
                <Globe className="size-4 text-[var(--color-muted-foreground)]" />
                <span className="flex-1">
                  <span className="font-medium text-[var(--color-foreground)]">{m.region}</span> ·{" "}
                  {m.time} · {m.title}
                </span>
                <Badge variant="muted" size="sm">
                  {m.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
