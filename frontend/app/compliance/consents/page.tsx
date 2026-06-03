"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Filter, Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type ConsentStatus = "active" | "revoked" | "expired";

interface Consent {
  id: string;
  patient: string;
  clinician: string;
  scope: string;
  scopes: string[];
  status: ConsentStatus;
  version: string;
  date: string;
}

interface Stats {
  active: number;
  revoked: number;
  expired: number;
  onStalePolicy: number;
  stalePolicyLabel: string;
}

function csvCell(value: string): string {
  const needsQuote = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export default function ComplianceConsents() {
  const [consents, setConsents] = useState<Consent[]>([]);
  const [stats, setStats] = useState<Stats>({ active: 0, revoked: 0, expired: 0, onStalePolicy: 0, stalePolicyLabel: "v2.4" });
  const [policyVersions, setPolicyVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<ConsentStatus[]>([]);
  const [versionFilters, setVersionFilters] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/compliance/consents", { cache: "no-store" });
        const json = await res.json();
        if (!alive || !json?.ok) return;
        setConsents(json.consents as Consent[]);
        setStats(json.stats as Stats);
        setPolicyVersions((json.policyVersions as string[]) ?? []);
      } catch (err) {
        console.error("[compliance/consents] fetch", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  function toggleStatus(s: ConsentStatus) {
    setStatusFilters((curr) => (curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]));
  }
  function toggleVersion(v: string) {
    setVersionFilters((curr) => (curr.includes(v) ? curr.filter((x) => x !== v) : [...curr, v]));
  }
  function clearFilters() {
    setStatusFilters([]);
    setVersionFilters([]);
  }

  const q = query.trim().toLowerCase();
  const filteredConsents = useMemo(
    () =>
      consents.filter((c) => {
        if (statusFilters.length > 0 && !statusFilters.includes(c.status)) return false;
        if (versionFilters.length > 0 && !versionFilters.includes(c.version)) return false;
        if (q && !`${c.id} ${c.patient} ${c.clinician} ${c.scope} ${c.version} ${c.status} ${c.date}`.toLowerCase().includes(q))
          return false;
        return true;
      }),
    [consents, q, statusFilters, versionFilters],
  );

  const activeCount = statusFilters.length + versionFilters.length;

  function exportCsv() {
    const header = ["Consent ID", "Patient", "Clinician", "Scope", "Status", "Policy version", "Date"];
    const rows = filteredConsents.map((c) => [c.id, c.patient, c.clinician, c.scope, c.status, c.version, c.date]);
    const csv = [header, ...rows].map((row) => row.map((v) => csvCell(String(v))).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "consents.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Consent export downloaded");
  }

  const stalePolicyLabel = `On stale policy (${stats.stalePolicyLabel === "v2.4" ? "pre-v2.4" : "older versions"})`;

  return (
    <>
      <PageHeader
        eyebrow="Consents"
        title="Organization-wide consent oversight"
        description="Read-only view. You cannot grant or revoke on behalf of patients — only investigate and approve sensitive-access workflows."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter /> Filter{activeCount > 0 ? ` · ${activeCount}` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("active"); }}>
                  {statusFilters.includes("active") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Active
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("revoked"); }}>
                  {statusFilters.includes("revoked") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Revoked
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("expired"); }}>
                  {statusFilters.includes("expired") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Expired
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Policy version</DropdownMenuLabel>
                {policyVersions.length === 0 ? (
                  <DropdownMenuItem disabled>No versions yet</DropdownMenuItem>
                ) : policyVersions.map((v) => (
                  <DropdownMenuItem key={v} onSelect={(e) => { e.preventDefault(); toggleVersion(v); }}>
                    {versionFilters.includes(v) ? <Check className="size-3.5" /> : <span className="size-3.5" />} {v}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={clearFilters}>Clear filters</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download /> Export
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Active", value: stats.active.toLocaleString(), good: true },
          { label: "Revoked", value: stats.revoked, danger: true },
          { label: "Expired", value: stats.expired },
          { label: stalePolicyLabel, value: stats.onStalePolicy, warn: true },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.good ? "text-[var(--color-success)]" : s.danger ? "text-[var(--color-danger)]" : s.warn ? "text-[var(--color-warning)]" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <Input
        placeholder="Search by patient, clinician, scope, policy version…"
        leadingIcon={<Search />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="grid grid-cols-12 gap-4 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <div className="col-span-2">Consent</div>
          <div className="col-span-2">Patient</div>
          <div className="col-span-2">Clinician</div>
          <div className="col-span-3">Scope</div>
          <div className="col-span-1">Policy</div>
          <div className="col-span-2 text-right">Status · Date</div>
        </div>
        {loading ? (
          <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 className="size-4 animate-spin" /> Loading consents…
          </p>
        ) : filteredConsents.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
            {consents.length === 0
              ? "No consents recorded in this tenant yet — rows appear here once patients approve or decline clinician access requests."
              : "No consents match the current filters."}
          </p>
        ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {filteredConsents.map((c) => (
            <li key={c.id}>
              <Link
                href={`/compliance/consents/${c.id}`}
                className="grid grid-cols-12 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-muted)]/40"
              >
                <div className="col-span-2 truncate font-mono text-xs" title={c.id}>{c.id.slice(0, 8)}</div>
                <div className="col-span-2 truncate text-sm" title={c.patient}>{c.patient}</div>
                <div className="col-span-2 truncate text-sm" title={c.clinician}>{c.clinician}</div>
                <div className="col-span-3 flex flex-wrap gap-1">
                  {c.scopes.length === 0 ? (
                    <Badge variant="muted" size="sm">—</Badge>
                  ) : c.scopes.map((s) => (
                    <Badge key={s} variant="muted" size="sm">{s}</Badge>
                  ))}
                </div>
                <div className="col-span-1 font-mono text-xs">{c.version}</div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  {c.status === "active" && <Badge variant="success" size="sm" dot>Active</Badge>}
                  {c.status === "revoked" && <Badge variant="danger" size="sm" dot>Revoked</Badge>}
                  {c.status === "expired" && <Badge variant="muted" size="sm">Expired</Badge>}
                  <span className="text-[11px] text-[var(--color-muted-foreground)]">{c.date}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        )}
      </div>
    </>
  );
}
