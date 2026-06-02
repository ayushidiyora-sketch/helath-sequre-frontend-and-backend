"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Check,
  Download,
  ScrollText,
  XCircle,
  AlertCircle,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ReportDownloadButton } from "@/components/shared/report-download-button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface AuditEvent {
  id: string;
  ts: string;
  time: string;
  actor: string;
  role: string;
  action: string;
  resource: string;
  status: "success" | "denied" | "failure";
  ip: string;
  flag?: "anomaly";
  sessionId: string;
}

interface Stats {
  events24h: number;
  denied: number;
  failures: number;
  anomalies: number;
}

const PAGE_SIZE = 10;

type AuditStatus = "success" | "denied" | "failure";

export default function AuditLogsPage() {
  return (
    <Suspense fallback={null}>
      <AuditLogsPageInner />
    </Suspense>
  );
}

function AuditLogsPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionFilter = params.get("session");

  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [stats, setStats] = useState<Stats>({ events24h: 0, denied: 0, failures: 0, anomalies: 0 });
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("All actions");
  const [statusFilters, setStatusFilters] = useState<AuditStatus[]>([]);
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/compliance/audit-logs", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok) return;
        if (Array.isArray(data.events)) setEvents(data.events as AuditEvent[]);
        if (data.stats) setStats(data.stats as Stats);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function clearSession() {
    router.push("/compliance/audit-logs");
  }

  function toggleStatus(s: AuditStatus) {
    setStatusFilters((curr) => (curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]));
    setPage(0);
  }
  function clearFilters() {
    setStatusFilters([]);
    setAnomalyOnly(false);
    setPage(0);
  }

  const q = query.trim().toLowerCase();
  const all = events ?? [];
  const filtered = all.filter((e) => {
    if (sessionFilter && e.sessionId !== sessionFilter) return false;
    if (actionFilter !== "All actions" && !e.action.startsWith(actionFilter.replace(".*", "")))
      return false;
    if (statusFilters.length > 0 && !statusFilters.includes(e.status)) return false;
    if (anomalyOnly && e.flag !== "anomaly") return false;
    if (!q) return true;
    return (
      e.actor.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      e.resource.toLowerCase().includes(q) ||
      e.ip.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q) ||
      e.status.toLowerCase().includes(q)
    );
  });

  const activeCount = statusFilters.length + (anomalyOnly ? 1 : 0);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <>
      <PageHeader
        eyebrow="Audit ledger"
        title="All events · append-only"
        description="Append-only ledger derived from real consent decisions, appointments, prescriptions, notes, messages, document uploads, MFA failures, and session creations in your tenant."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter /> Filters{activeCount > 0 ? ` · ${activeCount}` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("success"); }}>
                  {statusFilters.includes("success") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Success
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("denied"); }}>
                  {statusFilters.includes("denied") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Denied
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("failure"); }}>
                  {statusFilters.includes("failure") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Failure
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Flags</DropdownMenuLabel>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAnomalyOnly((v) => !v); setPage(0); }}>
                  {anomalyOnly ? <Check className="size-3.5" /> : <span className="size-3.5" />} Anomaly only
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={clearFilters}>Clear filters</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ReportDownloadButton report="access_report" format="pdf" size="sm">
              <Download /> Export filtered (PDF)
            </ReportDownloadButton>
          </>
        }
      />

      {sessionFilter && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-50)]/40 px-4 py-3">
          <Sparkles className="size-4 text-[var(--color-primary-700)]" />
          <p className="flex-1 text-sm">
            Showing <span className="font-semibold">{filtered.length}</span> events from session{" "}
            <span className="font-mono font-semibold">{sessionFilter}</span>
          </p>
          <Button variant="outline" size="sm" onClick={clearSession}>
            <X /> Clear session filter
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Events / 24h", value: stats.events24h.toLocaleString(), icon: ScrollText },
          { label: "Denied access", value: stats.denied, icon: XCircle, danger: true },
          { label: "Failures", value: stats.failures, icon: AlertCircle, warn: true },
          { label: "Anomalies flagged", value: stats.anomalies, icon: AlertCircle, warn: true },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
                <Icon className={`size-3.5 ${s.danger ? "text-[var(--color-danger)]" : s.warn ? "text-[var(--color-warning)]" : ""}`} /> {s.label}
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Free-text search · action codes, actor, resource ID, IP"
          leadingIcon={<Search />}
          className="flex-1 min-w-[260px]"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
        />
        <select
          className="h-10 rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
        >
          <option>All actions</option>
          <option>consent.*</option>
          <option>appointment.*</option>
          <option>prescription.*</option>
          <option>note.*</option>
          <option>message.*</option>
          <option>documents.*</option>
          <option>auth.*</option>
        </select>
        <select className="h-10 rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm" defaultValue="Last 30 days">
          <option>Last 24 hours</option>
          <option>Last 7 days</option>
          <option>Last 30 days</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
            <Sparkles className="size-3.5 text-[var(--color-primary)]" /> Live · {filtered.length} events
          </span>
          <SecurityBadge variant="audited" label="Append-only" />
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm font-mono">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <th className="px-4 py-2.5">Time</th>
              <th className="px-4 py-2.5">Actor</th>
              <th className="px-4 py-2.5">Action</th>
              <th className="px-4 py-2.5">Resource</th>
              <th className="px-4 py-2.5">IP</th>
              <th className="px-4 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {events === null && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center font-sans text-sm text-[var(--color-muted-foreground)]">
                  Loading audit events…
                </td>
              </tr>
            )}
            {events !== null && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center font-sans text-sm text-[var(--color-muted-foreground)]">
                  {all.length === 0
                    ? "No audit events in this tenant yet — events appear here as consent decisions, appointments, prescriptions, messages, and uploads land in the system."
                    : "No audit events match your search."}
                </td>
              </tr>
            )}
            {visible.map((e) => (
              <tr key={e.id} className="text-xs hover:bg-[var(--color-muted)]/30">
                <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{e.time}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-sans">
                    <span className="truncate font-medium">{e.actor}</span>
                    <Badge variant="muted" size="sm">{e.role}</Badge>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px]">
                    {e.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{e.resource}</td>
                <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{e.ip}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5 font-sans">
                    {e.status === "success" && <Badge variant="success" size="sm" dot>ok</Badge>}
                    {e.status === "denied" && <Badge variant="danger" size="sm">denied</Badge>}
                    {e.status === "failure" && <Badge variant="warning" size="sm">failure</Badge>}
                    {e.flag === "anomaly" && <Badge variant="warning" size="sm" dot>anomaly</Badge>}
                    <Link href={`/compliance/audit-logs/${e.id}`} className="rounded-md p-1 hover:bg-[var(--color-muted)]">
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
        <span>
          {filtered.length === 0
            ? "0 events"
            : `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()} events`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage(Math.max(0, safePage - 1))}
          >
            Previous
          </Button>
          <span className="px-2 tabular-nums">
            Page {safePage + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
