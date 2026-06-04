"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Activity,
  ShieldAlert,
  Users,
  AlertCircle,
  ArrowRight,
  Clock,
  HardDrive,
  Server,
  Database,
  Gauge,
  SlidersHorizontal,
  Layers,
  KeyRound,
  Bell,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";

/**
 * Super Admin dashboard — every number is fetched live from
 * `/api/super/dashboard` which reads only real tables (organizations, users,
 * sessions, messages, mfa_challenges, incidents, …). No hardcoded counts.
 */

interface DashboardData {
  stats: {
    activeTenants: number;
    tenantsThisQuarter: number;
    totalUsers: number;
    totalUsersDisplay: string;
    auditEventsPerDay: number;
    auditEventsPerDayDisplay: string;
    securityEvents24h: number;
    securityEscalated: number;
  };
  health: {
    apiLatencyMs: number;
    apiLatencyOk: boolean;
    errorRatePct: number;
    errorRateOk: boolean;
    queueDepth: number;
    queueDepthOk: boolean;
    dbActive: number;
    dbMax: number;
    dbConnectionsOk: boolean;
  };
  recentTenants: {
    id: string;
    slug: string;
    name: string;
    type: string;
    tier: string;
    region: string;
    users: number;
    storage: string;
    joined: string;
    initials: string;
  }[];
  incidents: {
    id: string;
    number: string;
    title: string;
    severity: string;
    status: string;
    scope: string | null;
    timeLabel: string;
  }[];
  platformConfig: {
    enabledFlags: number;
    tierCount: number;
    roleCount: number;
    regionCount: number;
  };
}

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SuperDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/super/dashboard", { cache: "no-store" });
        const j = (await r.json()) as DashboardData & { ok: boolean; error?: string };
        if (!alive) return;
        if (!r.ok || !j.ok) {
          setError(j.error ?? "Could not load dashboard.");
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

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Operations dashboard"
        description="Cross-tenant platform health, tenant provisioning, and configuration overview."
      />
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading platform metrics…
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-10 text-center text-sm text-[var(--color-danger)]">
          {error ?? "Dashboard data unavailable."}
        </div>
      ) : (
        <>
          <Stats data={data} />
          <PlatformHealth data={data} />
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-5">
              <RecentTenants data={data} />
              <PlatformConfig data={data} />
            </div>
            <div className="space-y-5">
              <ActiveIncidents data={data} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Stats({ data }: { data: DashboardData }) {
  const items = [
    {
      label: "Active tenants",
      value: data.stats.activeTenants.toLocaleString("en-IN"),
      sub:
        data.stats.tenantsThisQuarter > 0
          ? `+${data.stats.tenantsThisQuarter} this quarter`
          : "no new tenants in last 90 days",
      icon: Building2,
      accent: "from-[oklch(0.62_0.18_22)] to-[oklch(0.48_0.16_22)]",
    },
    {
      label: "Total users",
      value: data.stats.totalUsersDisplay,
      sub: "across all tenants",
      icon: Users,
      accent: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]",
    },
    {
      label: "Audit events / day",
      value: data.stats.auditEventsPerDayDisplay,
      sub: "sessions + audit log + messages + decisions",
      icon: Activity,
      accent: "from-[oklch(0.6_0.13_240)] to-[oklch(0.48_0.12_250)]",
    },
    {
      label: "Security events / 24h",
      value: data.stats.securityEvents24h.toLocaleString("en-IN"),
      sub:
        data.stats.securityEscalated > 0
          ? `${data.stats.securityEscalated} escalated`
          : "none escalated",
      icon: ShieldAlert,
      accent: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{s.label}</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{s.sub}</p>
              </div>
              <span
                className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.accent} text-white shadow-[var(--shadow-soft)]`}
              >
                <Icon className="size-4" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlatformHealth({ data }: { data: DashboardData }) {
  const metrics = [
    {
      label: "API latency · last query",
      value: `${data.health.apiLatencyMs} ms`,
      icon: Gauge,
      ok: data.health.apiLatencyOk,
    },
    {
      label: "Incident error rate (7d)",
      value: `${data.health.errorRatePct}%`,
      icon: Activity,
      ok: data.health.errorRateOk,
    },
    {
      label: "Queue depth",
      value: `${data.health.queueDepth.toLocaleString("en-IN")} jobs`,
      icon: Server,
      ok: data.health.queueDepthOk,
    },
    {
      label: "DB connections",
      value: `${data.health.dbActive} / ${data.health.dbMax}`,
      icon: Database,
      ok: data.health.dbConnectionsOk,
    },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Platform health</h2>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            Live infrastructure signals across all tenants
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/super/health">
            Detailed view <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="grid gap-px bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="bg-[var(--color-card)] p-4">
              <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--color-muted-foreground)]">
                <Icon className="size-3.5" /> {m.label}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <p className="text-xl font-semibold tabular-nums">{m.value}</p>
                {m.ok ? (
                  <Badge variant="success" size="sm" dot>
                    nominal
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm" dot>
                    attention
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentTenants({ data }: { data: DashboardData }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Recent tenants</h2>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">Provision · configure · suspend</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/super/tenants">
            All tenants <ArrowRight />
          </Link>
        </Button>
      </div>
      {data.recentTenants.length === 0 ? (
        <div className="p-6 text-center text-xs text-[var(--color-muted-foreground)]">No tenants yet.</div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {data.recentTenants.map((t) => (
            <li
              key={t.id}
              className="grid grid-cols-12 items-center gap-3 p-4 hover:bg-[var(--color-muted)]/40"
            >
              <div className="col-span-5 flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)] text-xs font-semibold">
                  {t.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">{titleCase(t.type)}</p>
                </div>
              </div>
              <div className="col-span-2">
                <Badge variant="muted" size="sm">
                  {titleCase(t.tier)}
                </Badge>
              </div>
              <div className="col-span-2 text-xs">
                <Users className="mr-1 inline-block size-3.5 text-[var(--color-muted-foreground)]" />
                {t.users}
              </div>
              <div className="col-span-2 text-xs">
                <HardDrive className="mr-1 inline-block size-3.5 text-[var(--color-muted-foreground)]" />
                {t.storage}
              </div>
              <div className="col-span-1 text-right text-[11px] text-[var(--color-muted-foreground)]">
                {t.joined}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlatformConfig({ data }: { data: DashboardData }) {
  const rows = [
    {
      icon: Layers,
      label: "Tenant feature flags",
      value: `${data.platformConfig.enabledFlags} tenants with multi-AZ / cross-region S3`,
    },
    {
      icon: SlidersHorizontal,
      label: "Subscription tiers in use",
      value: `${data.platformConfig.tierCount} of 3 (Basic · Pro · Enterprise)`,
    },
    {
      icon: KeyRound,
      label: "Roles defined across platform",
      value: `${data.platformConfig.roleCount} distinct role(s)`,
    },
    {
      icon: Bell,
      label: "Regions covered",
      value: `${data.platformConfig.regionCount} region(s) active`,
    },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Platform configuration</h2>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">Platform-wide defaults &amp; flags</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/super/platform">
            Configure <ArrowRight />
          </Link>
        </Button>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <li
              key={r.label}
              className="flex items-center gap-3 p-4 hover:bg-[var(--color-muted)]/40"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                <Icon className="size-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{r.label}</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{r.value}</p>
              </div>
              <ArrowRight className="size-4 text-[var(--color-muted-foreground)]" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActiveIncidents({ data }: { data: DashboardData }) {
  const incidents = data.incidents;
  const sevBadge = (sev: string) => {
    if (sev === "high") return <Badge variant="danger" size="sm" dot>{sev}</Badge>;
    if (sev === "medium") return <Badge variant="warning" size="sm" dot>{sev}</Badge>;
    return <Badge variant="warning" size="sm" dot>{sev}</Badge>;
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Active incidents</h2>
        <Badge variant={incidents.length > 0 ? "warning" : "muted"} size="sm">
          {incidents.length}
        </Badge>
      </div>
      {incidents.length === 0 ? (
        <div className="p-6 text-center text-xs text-[var(--color-muted-foreground)]">
          No active incidents.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {incidents.map((i) => (
            <li key={i.id} className="flex items-start gap-3 p-4">
              <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]">
                <AlertCircle className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-xs font-semibold">
                  {i.number} · {i.title}
                </p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">
                  <Clock className="mr-1 inline-block size-3" />
                  {i.timeLabel}
                  {i.scope ? ` · ${i.scope}` : ""}
                </p>
              </div>
              {sevBadge(i.severity)}
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-[var(--color-border)] p-3">
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/super/incidents">
            Incident timeline &amp; runbooks <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
