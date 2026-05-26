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
import { OPEN_ANOMALIES } from "../anomalies/anomalies-data";
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

function AnomalyFeed() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Open anomalies</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Auto-detected by the anomaly engine · awaiting your decision</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/compliance/anomalies">Review all <ArrowRight /></Link>
        </Button>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {OPEN_ANOMALIES.map((a) => (
          <li key={a.id} className="flex items-start gap-3 p-4 hover:bg-[var(--color-muted)]/40">
            <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${a.sev === "high" ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" : "bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]"}`}>
              <AlertTriangle className="size-4" />
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{a.title}</p>
                {a.sev === "high" && <Badge variant="danger" size="sm" dot>High</Badge>}
                {a.sev === "medium" && <Badge variant="warning" size="sm" dot>Medium</Badge>}
              </div>
              <p className="text-[11px] text-[var(--color-muted-foreground)]">{a.summary}</p>
              <p className="text-[10px] text-[var(--color-muted-foreground)]">Detected {a.time}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/compliance/anomalies/${a.id}`}>Investigate</Link>
            </Button>
          </li>
        ))}
      </ul>
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
  // Same 7d × 24h dataset as before — now rendered as a line chart of
  // hourly averages, weekday vs weekend, so trends pop instead of being
  // smeared across a grid.
  const HOURS = Array.from({ length: 24 }, (_, h) => h);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

  // Two averaged series.
  const avg = (rows: number[][], h: number) =>
    Math.round(rows.reduce((s, r) => s + r[h], 0) / rows.length);
  const weekday = HOURS.map((h) => avg(data.slice(0, 5), h));
  const weekend = HOURS.map((h) => avg(data.slice(5, 7), h));
  const max = Math.max(...weekday, ...weekend);
  // Round up to a tidy axis tick.
  const yMax = Math.ceil(max / 20) * 20;

  // SVG viewBox geometry.
  const W = 520;
  const H = 200;
  const PAD = { l: 30, r: 10, t: 10, b: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (h: number) => PAD.l + (h / 23) * innerW;
  const y = (v: number) => PAD.t + innerH * (1 - v / yMax);
  const toPath = (s: number[]) =>
    s.map((v, h) => `${h === 0 ? "M" : "L"}${x(h).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const toArea = (s: number[]) =>
    `${toPath(s)} L${x(23)},${y(0)} L${x(0)},${y(0)} Z`;

  // Peak marker on weekday curve.
  const peakHour = weekday.indexOf(Math.max(...weekday));
  const peakVal = weekday[peakHour];

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
          <h2 className="text-sm font-semibold">User activity · last 7 days</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Hourly average · all event categories</p>
        </div>
        <Badge variant="info" size="sm" dot>Quiet 00–05 IST</Badge>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-[var(--color-muted-foreground)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full bg-[var(--color-primary)]" />
          Weekday avg (Mon–Fri)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full bg-[oklch(0.72_0.14_75)]" />
          Weekend avg (Sat–Sun)
        </span>
      </div>

      {/* Chart */}
      <div className="mt-3 w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          preserveAspectRatio="none"
        >
          {/* Gridlines + y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const v = Math.round(yMax * t);
            const yy = y(v);
            return (
              <g key={t}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={yy}
                  y2={yy}
                  stroke="var(--color-border)"
                  strokeDasharray={t === 0 ? "0" : "2 3"}
                  strokeWidth={t === 0 ? 1 : 1}
                />
                <text
                  x={PAD.l - 6}
                  y={yy + 3}
                  textAnchor="end"
                  fontSize="9"
                  fontFamily="ui-monospace, monospace"
                  fill="var(--color-muted-foreground)"
                >
                  {v}
                </text>
              </g>
            );
          })}

          {/* Areas under curves */}
          <defs>
            <linearGradient id="weekday-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="weekend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.72 0.14 75)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="oklch(0.72 0.14 75)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={toArea(weekday)} fill="url(#weekday-fill)" />
          <path d={toArea(weekend)} fill="url(#weekend-fill)" />

          {/* Lines */}
          <path d={toPath(weekend)} fill="none" stroke="oklch(0.72 0.14 75)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={toPath(weekday)} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* Hour data points (weekday only, for clarity) */}
          {weekday.map((v, h) => (
            <circle key={h} cx={x(h)} cy={y(v)} r="2" fill="var(--color-primary)">
              <title>Weekday {String(h).padStart(2, "0")}:00 · {v} events (avg) · Weekend {weekend[h]}</title>
            </circle>
          ))}

          {/* Peak marker */}
          <g>
            <circle cx={x(peakHour)} cy={y(peakVal)} r="4" fill="var(--color-card)" stroke="var(--color-primary)" strokeWidth="2" />
            <line x1={x(peakHour)} x2={x(peakHour)} y1={y(peakVal)} y2={y(peakVal) - 14} stroke="var(--color-primary)" strokeDasharray="2 2" />
            <rect
              x={x(peakHour) - 32}
              y={y(peakVal) - 30}
              width="64"
              height="16"
              rx="3"
              fill="var(--color-primary)"
            />
            <text
              x={x(peakHour)}
              y={y(peakVal) - 19}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fontFamily="ui-monospace, monospace"
              fill="white"
            >
              Peak · {peakVal}
            </text>
          </g>

          {/* X-axis labels */}
          {HOURS.filter((h) => h % 3 === 0).map((h) => (
            <text
              key={h}
              x={x(h)}
              y={H - 8}
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              fill="var(--color-muted-foreground)"
            >
              {String(h).padStart(2, "0")}h
            </text>
          ))}
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-end gap-3 text-[11px] text-[var(--color-muted-foreground)]">
        <span>Peak <span className="font-mono">{String(peakHour).padStart(2, "0")}:00</span></span>
        <span>·</span>
        <span>Quietest <span className="font-mono">03:00</span></span>
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
