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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";

/**
 * Super Admin dashboard — surfaces the platform-operator spec areas:
 *  Tenant provisioning   → RecentTenants
 *  Platform configuration→ PlatformConfig
 *  Health monitoring     → PlatformHealth, ActiveIncidents
 */
export default function SuperDashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Operations dashboard"
        description="Cross-tenant platform health, tenant provisioning, and configuration overview."
      />
      <Stats />
      <PlatformHealth />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <RecentTenants />
          <PlatformConfig />
        </div>
        <div className="space-y-5">
          <ActiveIncidents />
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- Stats */

function Stats() {
  const items = [
    { label: "Active tenants", value: 18, sub: "+2 this quarter", icon: Building2, accent: "from-[oklch(0.62_0.18_22)] to-[oklch(0.48_0.16_22)]" },
    { label: "Total users", value: "87,422", sub: "across all tenants", icon: Users, accent: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]" },
    { label: "Audit events / day", value: "1.2 M", sub: "elevated retention", icon: Activity, accent: "from-[oklch(0.6_0.13_240)] to-[oklch(0.48_0.12_250)]" },
    { label: "Security events / 24h", value: 38, sub: "2 escalated", icon: ShieldAlert, accent: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{s.label}</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{s.sub}</p>
              </div>
              <span className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.accent} text-white shadow-[var(--shadow-soft)]`}>
                <Icon className="size-4" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------- Platform health monitoring */

function PlatformHealth() {
  const metrics = [
    { label: "API latency · p95", value: "142 ms", icon: Gauge, ok: true },
    { label: "Error rate", value: "0.04%", icon: Activity, ok: true },
    { label: "Queue depth", value: "312 jobs", icon: Server, ok: true },
    { label: "DB connections", value: "84 / 200", icon: Database, ok: true },
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
          <Link href="/super/health">Detailed view <ArrowRight /></Link>
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
                <Badge variant="success" size="sm" dot>nominal</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------- Tenant provisioning */

function RecentTenants() {
  const tenants = [
    { name: "Riverside Family Clinic", type: "Clinic", tier: "Pro", users: 24, storage: "12 GB", joined: "May 14", initials: "RC" },
    { name: "Northpoint Telecare", type: "Telemedicine", tier: "Basic", users: 8, storage: "1 GB", joined: "Apr 28", initials: "NT" },
    { name: "GreenLeaf Diagnostics", type: "Diagnostic", tier: "Enterprise", users: 41, storage: "98 GB", joined: "Apr 12", initials: "GL" },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Recent tenants</h2>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">Provision · configure · suspend</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/super/tenants">All tenants <ArrowRight /></Link>
        </Button>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {tenants.map((t) => (
          <li key={t.name} className="grid grid-cols-12 items-center gap-3 p-4 hover:bg-[var(--color-muted)]/40">
            <div className="col-span-5 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)] text-xs font-semibold">{t.initials}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{t.name}</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{t.type}</p>
              </div>
            </div>
            <div className="col-span-2"><Badge variant="muted" size="sm">{t.tier}</Badge></div>
            <div className="col-span-2 text-xs"><Users className="mr-1 inline-block size-3.5 text-[var(--color-muted-foreground)]" />{t.users}</div>
            <div className="col-span-2 text-xs"><HardDrive className="mr-1 inline-block size-3.5 text-[var(--color-muted-foreground)]" />{t.storage}</div>
            <div className="col-span-1 text-right text-[11px] text-[var(--color-muted-foreground)]">{t.joined}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------- Platform configuration */

function PlatformConfig() {
  const rows = [
    { icon: Layers, label: "Feature flags", value: "9 enabled · 3 per-tier" },
    { icon: SlidersHorizontal, label: "Subscription tiers", value: "Basic · Pro · Enterprise" },
    { icon: KeyRound, label: "Password policy floor", value: "Min 12 chars · history 5" },
    { icon: Bell, label: "Notification channels", value: "Email · SMS · webhook" },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Platform configuration</h2>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">Platform-wide defaults &amp; flags</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/super/platform">Configure <ArrowRight /></Link>
        </Button>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <li key={r.label} className="flex items-center gap-3 p-4 hover:bg-[var(--color-muted)]/40">
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

/* ----------------------------------------------------- Active incidents */

function ActiveIncidents() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Active incidents</h2>
        <Badge variant="warning" size="sm">2</Badge>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {[
          { sev: "minor" as const, t: "Elevated email-delivery latency (EU)", time: "12 min ago" },
          { sev: "minor" as const, t: "Increased 502s · ap-south-1 worker", time: "1h ago" },
        ].map((i, idx) => (
          <li key={idx} className="flex items-start gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]">
              <AlertCircle className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-xs font-semibold">{i.t}</p>
              <p className="text-[10px] text-[var(--color-muted-foreground)]"><Clock className="mr-1 inline-block size-3" />{i.time}</p>
            </div>
            <Badge variant="warning" size="sm" dot>{i.sev}</Badge>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--color-border)] p-3">
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/super/incidents">Incident timeline &amp; runbooks <ArrowRight /></Link>
        </Button>
      </div>
    </div>
  );
}
