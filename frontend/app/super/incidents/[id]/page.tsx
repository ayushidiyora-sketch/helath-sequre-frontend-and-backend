"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ShieldAlert,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ScrollText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Super Admin → Incident detail. Pulls one incident plus everything that
 * linked to it (break-glass sessions via `incidentRef`, anomaly_decisions via
 * `coordinatedWith LIKE %INC-NNNN%`) and lets the Super Admin advance through
 * the status state machine + record a resolution note when moving to
 * `resolved`.
 */

interface Incident {
  id: string;
  display: string;
  title: string;
  severity: string;
  status: string;
  scope: string | null;
  runbookUrl: string | null;
  openedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  openedByEmail: string | null;
}

interface BreakGlassRead {
  id: string;
  sessionDisplay: string;
  operatorEmail: string;
  endpoint: string;
  queryParams: string | null;
  recordCount: number;
  readAt: string;
}

interface BgSession {
  id: string;
  displayId: string;
  operatorEmail: string;
  targetOrgSlug: string | null;
  justification: string;
  status: string;
  startedAt: string;
  closedAt: string | null;
}

interface AnomalyDecision {
  signature: string;
  status: string;
  outcome: string | null;
  decidedByEmail: string | null;
  decidedAt: string | null;
  justification: string | null;
  coordinatedWith: string | null;
}

interface Payload {
  incident: Incident;
  breakGlass: BgSession[];
  anomalies: AnomalyDecision[];
  reads: BreakGlassRead[];
}

const STATUS_ORDER = ["open", "investigating", "mitigating", "monitoring", "resolved"];

function nextStatus(current: string): string {
  const i = STATUS_ORDER.indexOf(current);
  if (i < 0) return "investigating";
  return STATUS_ORDER[Math.min(i + 1, STATUS_ORDER.length - 1)];
}

function severityBadge(sev: string) {
  if (sev === "high") return <Badge variant="danger" size="sm" dot>High</Badge>;
  if (sev === "medium") return <Badge variant="warning" size="sm" dot>Medium</Badge>;
  return <Badge variant="warning" size="sm" dot>Minor</Badge>;
}

function statusBadge(st: string) {
  if (st === "resolved") return <Badge variant="success" size="sm" dot>Resolved</Badge>;
  if (st === "monitoring") return <Badge variant="info" size="sm" dot>Monitoring</Badge>;
  if (st === "mitigating") return <Badge variant="warning" size="sm" dot>Mitigating</Badge>;
  if (st === "investigating") return <Badge variant="info" size="sm" dot>Investigating</Badge>;
  return <Badge variant="danger" size="sm" dot>Open</Badge>;
}

function fmtAbsolute(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/super/incidents/${id}`, { cache: "no-store" });
      const j = (await r.json()) as Payload & { ok: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? "Could not load incident.");
        return;
      }
      setData(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = async () => {
    if (!data) return;
    const status = nextStatus(data.incident.status);
    if (status === "resolved") {
      setResolveOpen(true);
      return;
    }
    setAdvancing(true);
    try {
      const r = await fetch("/api/super/incidents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.incident.id, status }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        toast.error(j?.error ?? "Could not advance status.");
        return;
      }
      toast.success(`${data.incident.display} → ${status}`, { description: "Audit-logged" });
      await load();
    } finally {
      setAdvancing(false);
    }
  };

  const resolve = async () => {
    if (!data) return;
    setAdvancing(true);
    try {
      const r = await fetch("/api/super/incidents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.incident.id,
          status: "resolved",
          resolutionNote: resolutionNote.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        toast.error(j?.error ?? "Could not resolve.");
        return;
      }
      toast.success(`${data.incident.display} resolved`, {
        description: "Tenant CM(s) emailed · audit-logged",
      });
      setResolveOpen(false);
      setResolutionNote("");
      await load();
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading incident…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-[var(--color-muted-foreground)]">
          <Link
            href="/super/incidents"
            className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
          >
            <ArrowLeft className="size-3.5" /> Incidents
          </Link>
        </div>
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-10 text-center text-sm text-[var(--color-danger)]">
          {error ?? "Incident not found."}
        </div>
      </div>
    );
  }

  const { incident, breakGlass, anomalies, reads } = data;
  const isResolved = incident.status === "resolved";
  const nextLabel = nextStatus(incident.status);

  return (
    <>
      <div className="text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/super/incidents"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Incidents
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[var(--color-foreground)]">{incident.display}</span>
      </div>

      <div
        className={`overflow-hidden rounded-2xl border p-6 ${
          incident.severity === "high"
            ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20"
            : "border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/20"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-11 items-center justify-center rounded-xl bg-[var(--color-card)] ring-1 ${
                incident.severity === "high"
                  ? "text-[var(--color-danger)] ring-[var(--color-danger)]/30"
                  : "text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)] ring-[var(--color-warning)]/30"
              }`}
            >
              <ShieldAlert className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-xs">{incident.display}</p>
                {severityBadge(incident.severity)}
                {statusBadge(incident.status)}
                {incident.scope && (
                  <span className="rounded-md bg-[var(--color-muted)]/40 px-2 py-0.5 font-mono text-[10px]">
                    {incident.scope}
                  </span>
                )}
              </div>
              <h1 className="mt-1.5 text-xl font-semibold leading-tight">{incident.title}</h1>
              <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
                Opened {fmtAbsolute(incident.openedAt)}
                {incident.openedByEmail ? ` · by ${incident.openedByEmail}` : ""}
                {incident.resolvedAt ? ` · Resolved ${fmtAbsolute(incident.resolvedAt)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {incident.runbookUrl && (
              <Button asChild variant="outline">
                <a href={incident.runbookUrl} target="_blank" rel="noopener noreferrer">
                  Open runbook
                </a>
              </Button>
            )}
            {!isResolved && (
              <Button onClick={advance} disabled={advancing}>
                {advancing ? <Loader2 className="animate-spin" /> : null} Advance to {nextLabel}
              </Button>
            )}
          </div>
        </div>
        {isResolved && incident.resolutionNote && (
          <div className="mt-4 rounded-lg bg-[var(--color-success-soft)]/30 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-success)]">
              Resolution note
            </p>
            <p className="mt-1 italic text-[var(--color-muted-foreground)]">
              &ldquo;{incident.resolutionNote}&rdquo;
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <Flame className="size-4 text-[var(--color-danger)]" /> Linked break-glass sessions
          </h2>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            Break-glass sessions opened with this incident referenced in the form.
          </p>
          {breakGlass.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted-foreground)]">
              No break-glass sessions linked to {incident.display}.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {breakGlass.map((b) => (
                <li
                  key={b.id}
                  className="rounded-xl border border-[var(--color-border)] p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px]">{b.displayId}</span>
                    <span className="font-medium">{b.operatorEmail}</span>
                    {b.status === "active" ? (
                      <Badge variant="danger" size="sm" dot>
                        Active
                      </Badge>
                    ) : b.status === "expired" ? (
                      <Badge variant="warning" size="sm">
                        Expired
                      </Badge>
                    ) : (
                      <Badge variant="muted" size="sm">
                        Closed
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
                    On {b.targetOrgSlug ?? "—"} · Started {fmtAbsolute(b.startedAt)}
                    {b.closedAt ? ` · Closed ${fmtAbsolute(b.closedAt)}` : ""}
                  </p>
                  <p className="mt-1 line-clamp-2 italic text-[var(--color-muted-foreground)]">
                    {b.justification}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <AlertTriangle className="size-4 text-[var(--color-warning)]" /> Linked anomaly
            decisions
          </h2>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            CM anomaly resolutions that referenced this incident in their{" "}
            <code className="font-mono">coordinatedWith</code> field.
          </p>
          {anomalies.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted-foreground)]">
              No anomaly decisions reference {incident.display}.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {anomalies.map((a) => (
                <li
                  key={a.signature}
                  className="rounded-xl border border-[var(--color-border)] p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <ScrollText className="size-3 text-[var(--color-muted-foreground)]" />
                    <span className="font-mono text-[10px]">{a.signature.slice(0, 64)}</span>
                    {a.outcome === "incident" ? (
                      <Badge variant="danger" size="sm">
                        Escalated
                      </Badge>
                    ) : a.outcome === "policy_update" ? (
                      <Badge variant="info" size="sm">
                        Rule tuned
                      </Badge>
                    ) : a.outcome === "legitimate" ? (
                      <Badge variant="success" size="sm">
                        Legitimate
                      </Badge>
                    ) : (
                      <Badge variant="muted" size="sm">
                        {a.status}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
                    {a.decidedByEmail ?? "—"} · {a.decidedAt ? fmtAbsolute(a.decidedAt) : "pending"}
                    {a.coordinatedWith ? ` · ${a.coordinatedWith}` : ""}
                  </p>
                  {a.justification && (
                    <p className="mt-1 line-clamp-2 italic text-[var(--color-muted-foreground)]">
                      {a.justification}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <ScrollText className="size-4 text-[var(--color-muted-foreground)]" /> PHI reads during break-glass
        </h2>
        <p className="text-[11px] text-[var(--color-muted-foreground)]">
          Every tenant-scoped read the Super Admin made inside a break-glass session linked to this incident.
          Tagged <code className="font-mono">break_glass=true</code> in the audit ledger.
        </p>
        {reads.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted-foreground)]">
            No tagged reads recorded for {incident.display}.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full min-w-[600px] text-xs">
              <thead className="bg-[var(--color-muted)]/40 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Session</th>
                  <th className="px-3 py-2 text-left">Operator</th>
                  <th className="px-3 py-2 text-left">Endpoint</th>
                  <th className="px-3 py-2 text-right">Records</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {reads.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--color-muted)]/30">
                    <td className="px-3 py-2 text-[var(--color-muted-foreground)]">{fmtAbsolute(r.readAt)}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{r.sessionDisplay}</td>
                    <td className="px-3 py-2">{r.operatorEmail}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{r.endpoint}{r.queryParams ? `?${r.queryParams}` : ""}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{r.recordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <CheckCircle2 className="size-4 text-[var(--color-success)]" /> Lifecycle
        </h2>
        <ol className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {STATUS_ORDER.map((s) => {
            const idx = STATUS_ORDER.indexOf(s);
            const currentIdx = STATUS_ORDER.indexOf(incident.status);
            const reached = idx <= currentIdx;
            return (
              <li
                key={s}
                className={`rounded-full border px-3 py-1 ${
                  reached
                    ? "border-[var(--color-success)]/40 bg-[var(--color-success-soft)]/30 text-[var(--color-success)]"
                    : "border-[var(--color-border)] text-[var(--color-muted-foreground)]"
                }`}
              >
                {s}
              </li>
            );
          })}
        </ol>
      </div>

      <Dialog open={resolveOpen} onOpenChange={(o) => !o && setResolveOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve {incident.display}?</DialogTitle>
            <DialogDescription>
              Record a resolution note. The tenant&apos;s Compliance Manager(s) will be emailed
              with the note included so they can sign off on the post-mortem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="inc-note">Resolution note (optional)</Label>
            <Textarea
              id="inc-note"
              rows={4}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="What was the root cause? What did you do to remediate? Any follow-ups?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)} disabled={advancing}>
              Cancel
            </Button>
            <Button onClick={resolve} disabled={advancing}>
              {advancing ? <Loader2 className="animate-spin" /> : null} Mark resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
