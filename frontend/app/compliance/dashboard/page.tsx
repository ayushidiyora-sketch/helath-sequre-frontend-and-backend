import Link from "next/link";
import {
  ScrollText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Activity,
  TrendingUp,
  ArrowRight,
  Eye,
  XCircle,
  Sparkles,
  Hourglass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ReportsWidget } from "@/components/shared/reports-widget";
import { AnomalyFeed } from "./anomaly-feed";
import { OPEN_APPROVALS } from "../approvals/approvals-data";

export default function ComplianceDashboard() {
  return (
    <>
      <Hero />
      <Scorecard />
      {/* <ReportsWidget preset="compliance" /> */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <AnomalyFeed />
          {/* <AuditVolume /> */}
          <ActivityHeatmap />
        </div>
        <div className="space-y-5">
          <PendingApprovals />
          <PolicyCoverage />
        </div>
      </div>
    </>
  );
}

function Hero() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[oklch(0.96_0.025_75)] p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gradient-to-br from-[oklch(0.75_0.15_75)] to-transparent opacity-25 blur-3xl" />
      <div className="relative grid gap-5 sm:grid-cols-[1.4fr_1fr] sm:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
            HIPAA · GDPR · 21 CFR Part 11
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Compliance posture: <span className="text-[var(--color-success)]">Strong</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-[var(--color-muted-foreground)]">
            12,489 audit events captured in the last 24 hours. 4 anomalies surfaced.
            Consent policy v2.4 is at 94% adoption.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link href="/compliance/audit-logs"><ScrollText /> Open ledger</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/compliance/reports">Run access report</Link></Button>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Posture score</p>
            <Badge variant="success" size="sm" dot>+2 wk/wk</Badge>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative size-16">
              <svg viewBox="0 0 36 36" className="size-16 -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-muted)" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-success)" strokeWidth="3" strokeDasharray="100 100" strokeDashoffset="9" strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-base font-semibold">91</span>
            </div>
            <div className="text-xs">
              <p className="font-semibold">Strong</p>
              <p className="text-[var(--color-muted-foreground)]">Action: review 4 open anomalies</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scorecard() {
  const items = [
    { label: "Active consents", value: "1,284", icon: Shield, sub: "+18 this week", accent: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]" },
    { label: "Audit events / 24h", value: "12,489", icon: ScrollText, sub: "p95 latency 168ms", accent: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]" },
    { label: "Open anomalies", value: 4, icon: AlertTriangle, sub: "1 high · 3 medium", accent: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]" },
    { label: "Policy v2.4 adoption", value: "94%", icon: CheckCircle2, sub: "256 stale consents", accent: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]" },
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
                <Icon className="size-4.5" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AuditVolume() {
  const buckets = [
    { hr: "00", v: 32 },
    { hr: "03", v: 18 },
    { hr: "06", v: 124 },
    { hr: "09", v: 892 },
    { hr: "12", v: 1248 },
    { hr: "15", v: 1402 },
    { hr: "18", v: 612 },
    { hr: "21", v: 184 },
  ];
  const max = Math.max(...buckets.map((b) => b.v));
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Audit volume · last 24h</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">By 3-hour bucket · all event categories</p>
        </div>
        <Badge variant="info" size="sm" dot>Streaming</Badge>
      </div>
      <div className="mt-6 flex items-end gap-2 h-40">
        {buckets.map((b) => (
          <div key={b.hr} className="flex flex-1 flex-col items-center gap-2">
            <div className="relative flex w-full flex-1 items-end">
              <div className="w-full rounded-t-lg bg-gradient-to-t from-[var(--color-primary)] to-[oklch(0.62_0.12_185)]" style={{ height: `${(b.v / max) * 100}%` }} />
            </div>
            <p className="text-[10px] font-mono tabular-nums text-[var(--color-muted-foreground)]">{b.hr}h</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityHeatmap() {
  // Last 7 days × 24 hours. Higher numbers = more events. Quiet 0–5 IST,
  // peak around 11–15 IST. Hand-tuned to look realistic for a clinic.
  const HOURS = Array.from({ length: 24 }, (_, h) => h);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // Deterministic "noise" so the chart is stable between renders.
  const noise = (d: number, h: number) => ((d * 31 + h * 17) % 13) / 12;
  const data: number[][] = DAYS.map((_, d) =>
    HOURS.map((h) => {
      const n = noise(d, h);
      if (h < 6 || h > 22) return Math.round(2 + n * 8);
      const wknd = d >= 5;
      const peak = h >= 10 && h <= 15;
      const shoulder = (h >= 8 && h <= 17) && !peak;
      if (wknd) return Math.round((peak ? 35 : shoulder ? 18 : 8) + n * 12);
      return Math.round((peak ? 90 : shoulder ? 55 : 22) + n * 25);
    }),
  );
  const flat = data.flat();
  const max = Math.max(...flat);

  // Top active users — static for the demo.
  const TOP = [
    { name: "Mr. Patel · Org Admin", events: 1842 },
    { name: "Dr. K. Patel · Cardiology", events: 1140 },
    { name: "Dr. R. Iyer · Internal Med", events: 988 },
    { name: "Dr. P. Shah · Pediatrics", events: 902 },
  ];

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">User activity heatmap · last 7 days</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">By hour of day · all event categories</p>
        </div>
        <Badge variant="info" size="sm" dot>Quiet 00–05 IST</Badge>
      </div>

      <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        {DAYS.map((d, dIdx) => (
          <Row key={d} label={d} cells={data[dIdx]} max={max} />
        ))}
        <span />
        <div className="mt-1 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5 text-[8px] tabular-nums text-[var(--color-muted-foreground)]">
          {HOURS.map((h) => (
            <span key={h} className="text-center">{h % 3 === 0 ? h : ""}</span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--color-muted-foreground)]">
        <div className="flex items-center gap-2">
          <span>Less</span>
          {[0.1, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <span key={i} className="size-3 rounded-sm" style={{ background: `color-mix(in oklab, var(--color-primary) ${Math.round(p * 100)}%, var(--color-muted))` }} />
          ))}
          <span>More</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Peak <span className="font-mono">11–15h</span></span>
          <span>·</span>
          <span>Quietest <span className="font-mono">03h</span></span>
        </div>
      </div>

      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        <p className="text-xs font-semibold">Top active users (7d)</p>
        <ul className="mt-2 space-y-1.5">
          {TOP.map((u) => {
            const pct = Math.round((u.events / TOP[0].events) * 100);
            return (
              <li key={u.name} className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-[var(--color-muted)]/60">
                    <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="font-mono tabular-nums text-[var(--color-muted-foreground)]">{u.events.toLocaleString()}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Row({ label, cells, max }: { label: string; cells: number[]; max: number }) {
  return (
    <>
      <span className="pr-1 text-right text-[10px] font-mono uppercase tracking-wider text-[var(--color-muted-foreground)] self-center">{label}</span>
      <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5">
        {cells.map((v, i) => {
          const intensity = v / max;
          return (
            <span
              key={i}
              title={`${label} ${i}:00 · ${v} events`}
              className="aspect-square rounded-sm"
              style={{ background: intensity < 0.05 ? "var(--color-muted)" : `color-mix(in oklab, var(--color-primary) ${Math.round(intensity * 100)}%, var(--color-muted))` }}
            />
          );
        })}
      </div>
    </>
  );
}

function PendingApprovals() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Sensitive-access requests</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Approve, reject, or ask for more info</p>
        </div>
        <Badge variant="warning" size="sm">{OPEN_APPROVALS.length}</Badge>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {OPEN_APPROVALS.map((r) => (
          <li key={r.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]">
                <Hourglass className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-xs font-semibold">{r.requester}</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{r.patientLabel} · {r.flag}</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="mt-3 w-full">
              <Link href={`/compliance/approvals/${r.id}`}>Review <ArrowRight /></Link>
            </Button>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--color-border)] p-3">
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/compliance/approvals">Open queue <ArrowRight /></Link>
        </Button>
      </div>
    </div>
  );
}

function PolicyCoverage() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h2 className="text-sm font-semibold">Consent policy adoption</h2>
      <p className="text-xs text-[var(--color-muted-foreground)]">Patients consented under the latest policy version.</p>
      <div className="mt-4 space-y-3">
        {[
          { v: "v2.4 (active)", pct: 94, active: true },
          { v: "v2.3", pct: 5, stale: true },
          { v: "v2.2", pct: 1, stale: true },
        ].map((p) => (
          <div key={p.v}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className={p.active ? "font-medium" : "text-[var(--color-muted-foreground)]"}>{p.v}</span>
              <span className="font-mono tabular-nums">{p.pct}%</span>
            </div>
            <Progress value={p.pct} />
          </div>
        ))}
      </div>
      <Button asChild variant="outline" size="sm" className="mt-4 w-full">
        <Link href="/compliance/consent-policies">Manage policies <ArrowRight /></Link>
      </Button>
    </div>
  );
}
