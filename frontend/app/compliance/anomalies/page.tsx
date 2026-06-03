"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Shield,
  CheckCircle2,
  ScrollText,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/shared/action-button";
import { encodeSigBrowser } from "@/lib/anomaly-sig";
import { ResolveAnomalyButton } from "./resolve-anomaly";

type Severity = "low" | "medium" | "high" | "critical";
type Status = "open" | "investigating" | "resolved" | "dismissed";

interface Anomaly {
  id: string;
  signature: string;
  type: string;
  title: string;
  summary: string;
  description: string;
  severity: Severity;
  status: Status;
  actor: string;
  actorId: string | null;
  ip: string;
  events: number;
  detectedAt: string;
  time: string;
  window: string;
  evidence: string[];
  recommendation: string;
  decision?: {
    outcome: string | null;
    coordinatedWith: string | null;
    justification: string | null;
    decidedByEmail: string | null;
    decidedAt: string | null;
  };
}

interface Stats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  dismissed: number;
  critical: number;
  high: number;
}

const SEVERITY_OPTIONS: Array<{ key: Severity | "all"; label: string }> = [
  { key: "all",      label: "All severities" },
  { key: "critical", label: "Critical" },
  { key: "high",     label: "High" },
  { key: "medium",   label: "Medium" },
  { key: "low",      label: "Low" },
];

const TYPE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "all",                  label: "All types" },
  { key: "bulkUpload",           label: "Bulk uploads" },
  { key: "failedMFA",            label: "Failed MFA" },
  { key: "offHoursAccess",       label: "Off-hours" },
  { key: "consentRevokedAccess", label: "Consent revoked" },
  { key: "unassignedPatient",    label: "Unassigned patient" },
  { key: "excessiveViews",       label: "Excessive views" },
  { key: "breakGlass",           label: "Break-glass" },
  { key: "unusualIp",            label: "Unusual IP" },
  { key: "lockedAccount",        label: "Locked account" },
  { key: "bruteForce",           label: "Brute force" },
  { key: "infectedUpload",       label: "Infected upload" },
];

const PAGE_SIZE = 8;

const SEV_BG: Record<Severity, string> = {
  critical: "border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]/30",
  high:     "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20",
  medium:   "border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/20",
  low:      "border-[var(--color-border)] bg-[var(--color-card)]",
};

const SEV_ICON: Record<Severity, string> = {
  critical: "bg-[var(--color-card)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/40",
  high:     "bg-[var(--color-card)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/30",
  medium:   "bg-[var(--color-card)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)] ring-1 ring-[var(--color-warning)]/30",
  low:      "bg-[var(--color-card)] text-[var(--color-muted-foreground)] ring-1 ring-[var(--color-border)]",
};

function severityBadge(sev: Severity) {
  if (sev === "critical") return <Badge variant="danger" size="sm" dot>Critical</Badge>;
  if (sev === "high")     return <Badge variant="danger" size="sm" dot>High</Badge>;
  if (sev === "medium")   return <Badge variant="warning" size="sm" dot>Medium</Badge>;
  return <Badge variant="muted" size="sm" dot>Low</Badge>;
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [type, setType] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/compliance/anomalies", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (json?.ok) {
          setAnomalies(json.anomalies as Anomaly[]);
          setStats(json.stats as Stats);
        }
      } catch (err) { console.error("[anomalies] fetch", err); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const openItems = useMemo(
    () => anomalies.filter((a) => a.status === "open" || a.status === "investigating"),
    [anomalies],
  );
  const closedItems = useMemo(
    () => anomalies.filter((a) => a.status === "resolved" || a.status === "dismissed"),
    [anomalies],
  );

  const filteredOpen = useMemo(() => applyFilters(openItems, { search, severity, type }), [openItems, search, severity, type]);
  const filteredClosed = useMemo(() => applyFilters(closedItems, { search, severity, type }), [closedItems, search, severity, type]);

  useEffect(() => { setPage(0); }, [tab, search, severity, type]);

  const list = tab === "open" ? filteredOpen : filteredClosed;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const visible = list.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  function reload() { setReloadKey((k) => k + 1); }

  return (
    <>
      <PageHeader
        eyebrow="Anomalies"
        title="Behavioral exceptions"
        description="Surfaced by the anomaly engine. Each open item requires your decision to dismiss, escalate, or open an incident."
      />

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Open" value={stats.open} />
          <StatTile label="Investigating" value={stats.investigating} />
          <StatTile label="Critical" value={stats.critical} accent="danger" />
          <StatTile label="High" value={stats.high} accent="warning" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor, IP, type, or keyword…"
            className="pl-9"
          />
        </div>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity | "all")}
          className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm"
        >
          {SEVERITY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm"
        >
          {TYPE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "open" | "closed")}>
        <TabsList>
          <TabsTrigger value="open">Open · {filteredOpen.length}</TabsTrigger>
          <TabsTrigger value="closed">Closed · {filteredClosed.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          {loading ? (
            <LoadingBlock />
          ) : visible.length === 0 ? (
            <EmptyBlock message="No open anomalies match the current filters." />
          ) : (
            <div className="space-y-4">
              {visible.map((a) => (
                <OpenCard key={a.signature} a={a} onResolved={reload} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closed">
          {loading ? (
            <LoadingBlock />
          ) : visible.length === 0 ? (
            <EmptyBlock message="No closed anomalies yet." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <ul className="divide-y divide-[var(--color-border)]">
                {visible.map((a) => <ClosedRow key={a.signature} a={a} />)}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {list.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
          <span>Showing {pageSafe * PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PAGE_SIZE, list.length)} of {list.length}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={pageSafe === 0} onClick={() => setPage(Math.max(0, pageSafe - 1))}>
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <span className="px-2">Page {pageSafe + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={pageSafe >= totalPages - 1} onClick={() => setPage(Math.min(totalPages - 1, pageSafe + 1))}>
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function buildAuditLogsHref(a: Anomaly): string {
  const sp = new URLSearchParams();
  if (a.actor && a.actor !== "—") sp.set("q", a.actor);
  if (a.type === "failedMFA" || a.type === "lockedAccount" || a.type === "bruteForce" || a.type === "infectedUpload") {
    sp.set("anomaly", "1");
  }
  const qs = sp.toString();
  return qs ? `/compliance/audit-logs?${qs}` : "/compliance/audit-logs";
}

function applyFilters(list: Anomaly[], f: { search: string; severity: Severity | "all"; type: string }) {
  const q = f.search.trim().toLowerCase();
  return list.filter((a) => {
    if (f.severity !== "all" && a.severity !== f.severity) return false;
    if (f.type !== "all" && a.type !== f.type) return false;
    if (!q) return true;
    return (
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.actor.toLowerCase().includes(q) ||
      a.ip.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q)
    );
  });
}

function OpenCard({ a, onResolved }: { a: Anomaly; onResolved: () => void }) {
  const investigating = a.status === "investigating";
  return (
    <div className={`overflow-hidden rounded-2xl border p-5 ${SEV_BG[a.severity]}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`flex size-10 items-center justify-center rounded-xl ${SEV_ICON[a.severity]}`}>
            <AlertTriangle className="size-5" />
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{a.title}</h3>
              {severityBadge(a.severity)}
              {investigating && <Badge variant="info" size="sm" dot>Investigating</Badge>}
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{a.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
              <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {a.time}</span>
              <span className="inline-flex items-center gap-1"><ScrollText className="size-3" /> {a.events} events</span>
              <span className="inline-flex items-center gap-1"><Shield className="size-3" /> Anomaly engine v2</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/compliance/anomalies/${encodeSigBrowser(a.signature)}`}>Investigate</Link>
          </Button>
          <ActionButton
            variant="outline"
            size="sm"
            href={buildAuditLogsHref(a)}
            toastMessage={`Filtering ledger by ${a.actor}`}
            toastVariant="info"
          >
            View events
          </ActionButton>
          <ResolveAnomalyButton anomalyId={a.signature} label="Resolve…" onDone={onResolved} />
        </div>
      </div>
    </div>
  );
}

function ClosedRow({ a }: { a: Anomaly }) {
  const outcomeLabel =
    a.decision?.outcome === "incident" ? "Incident opened"
      : a.decision?.outcome === "policy_update" ? "Rule tuned"
      : a.decision?.outcome === "legitimate" ? "Legitimate"
      : a.status === "dismissed" ? "Dismissed"
      : "Resolved";
  const date = a.decision?.decidedAt
    ? new Date(a.decision.decidedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
    : "—";
  return (
    <li className="flex items-start gap-3 p-4">
      <CheckCircle2 className="mt-0.5 size-5 text-[var(--color-success)]" />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{a.title}</p>
          <Badge variant={outcomeLabel === "Incident opened" ? "danger" : "success"} size="sm">{outcomeLabel}</Badge>
          {severityBadge(a.severity)}
        </div>
        <p className="text-[11px] text-[var(--color-muted-foreground)]">
          By {a.decision?.decidedByEmail ?? "—"} · {date}
          {a.decision?.coordinatedWith ? ` · coordinated with ${a.decision.coordinatedWith}` : ""}
        </p>
        {a.decision?.justification && (
          <p className="mt-1 text-[11px] italic text-[var(--color-muted-foreground)]/90">{a.decision.justification}</p>
        )}
      </div>
    </li>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: "danger" | "warning" }) {
  const tone =
    accent === "danger" ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20"
    : accent === "warning" ? "border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/20"
    : "border-[var(--color-border)] bg-[var(--color-card)]";
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
      <Loader2 className="mr-2 size-4 animate-spin" /> Loading anomalies…
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
      {message}
    </div>
  );
}
