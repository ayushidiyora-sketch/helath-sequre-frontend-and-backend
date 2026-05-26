"use client";

import { useState } from "react";
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
  t: string;
  actor: string;
  role: string;
  action: string;
  resource: string;
  status: "success" | "denied" | "failure";
  ip: string;
  reason?: string;
  flag?: string;
  sessionId: string;
}

/** Base event templates — cycled to build a realistic, paginatable ledger. */
const BASE: Omit<AuditEvent, "id" | "t">[] = [
  { actor: "priya.shah@citygeneral", role: "Clinician", action: "records.read", resource: "rec-lp-0518", status: "success", ip: "10.0.0.42", sessionId: "sess_4f12a3" },
  { actor: "priya.shah@citygeneral", role: "Clinician", action: "records.read", resource: "rec-img-0501", status: "denied", ip: "10.0.0.42", reason: "consent_revoked", sessionId: "sess_4f12a3" },
  { actor: "riya.mehta@portal", role: "Patient", action: "consent.revoke", resource: "cns_8a90c", status: "success", ip: "203.0.113.42", sessionId: "sess_a7b4d2" },
  { actor: "compliance@citygeneral", role: "Compliance", action: "report.export", resource: "rpt_access_q2", status: "success", ip: "10.0.0.50", sessionId: "sess_compl_01" },
  { actor: "aarav.mehta@portal", role: "Patient", action: "records.download", resource: "rec-lp-0518", status: "success", ip: "203.0.113.42", sessionId: "sess_a7b4d2" },
  { actor: "auditor@regulator", role: "Auditor", action: "audit.view", resource: "window_24h", status: "success", ip: "203.0.113.99", sessionId: "sess_aud_12" },
  { actor: "maya.iyer@citygeneral", role: "Org Admin", action: "user.invite", resource: "usr_x12", status: "success", ip: "10.0.0.21", sessionId: "sess_admin_44" },
  { actor: "k.patel@citygeneral", role: "Clinician", action: "documents.download_bulk", resource: "32 docs", status: "success", ip: "198.51.100.7", flag: "anomaly", sessionId: "sess_kpatel_99" },
  { actor: "auditor@regulator", role: "Auditor", action: "auth.mfa_failure", resource: "—", status: "failure", ip: "203.0.113.99", flag: "anomaly", sessionId: "sess_aud_12" },
  { actor: "system", role: "System", action: "notification.send", resource: "reminder_T-24h", status: "success", ip: "—", sessionId: "sess_system" },
];

const TOTAL = 200;
const PAGE_SIZE = 10;

/** Build a descending-timestamp ledger of TOTAL synthetic events. */
const EVENTS: AuditEvent[] = Array.from({ length: TOTAL }, (_, i) => {
  const base = BASE[i % BASE.length];
  const startSec = 12 * 3600 + 4 * 60 + 18; // 12:04:18
  const sec = ((startSec - i * 47) % 86400 + 86400) % 86400;
  const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return { ...base, id: `evt_${(35000 - i).toString(16)}`, t: `${hh}:${mm}:${ss}` };
});

type AuditStatus = "success" | "denied" | "failure";

export default function AuditLogsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionFilter = params.get("session");

  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("All actions");
  const [statusFilters, setStatusFilters] = useState<AuditStatus[]>([]);
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [page, setPage] = useState(0);

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
  const filtered = EVENTS.filter((e) => {
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
        description="Append-only ledger with rolling cryptographic checksums. Filterable by actor, action, resource, IP, and time window."
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
          { label: "Events / 24h", value: "12,489", icon: ScrollText },
          { label: "Denied access", value: 38, icon: XCircle, danger: true },
          { label: "Failures", value: 14, icon: AlertCircle, warn: true },
          { label: "Anomalies flagged", value: 4, icon: AlertCircle, warn: true },
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
          <option>records.*</option>
          <option>consent.*</option>
          <option>auth.*</option>
          <option>documents.*</option>
        </select>
        <select className="h-10 rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm">
          <option>Last 24 hours</option>
          <option>Last 7 days</option>
          <option>Last 30 days</option>
          <option>Custom…</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
            <Sparkles className="size-3.5 text-[var(--color-primary)]" /> Streaming · 12 events in the last 60 s
          </span>
          <SecurityBadge variant="audited" label="Append-only" />
        </div>
        <table className="w-full text-sm font-mono">
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
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center font-sans text-sm text-[var(--color-muted-foreground)]">
                  No audit events match your search.
                </td>
              </tr>
            )}
            {visible.map((e) => (
              <tr key={e.id} className="text-xs hover:bg-[var(--color-muted)]/30">
                <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{e.t}</td>
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
                    {e.status === "denied" && <Badge variant="danger" size="sm" title={e.reason}>denied</Badge>}
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
