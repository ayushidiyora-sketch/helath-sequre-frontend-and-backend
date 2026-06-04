"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Database,
  Clock,
  AlertTriangle,
  Trash2,
  Edit,
  ArrowRight,
  Download,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input, Label } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";

type RequestStatus =
  | "pending"
  | "in_progress"
  | "approved_partial"
  | "approved_full"
  | "rejected"
  | "blocked";

interface Bucket {
  key: string;
  name: string;
  retention: string;
  deletion: string;
  count: string;
}
interface Override {
  pausePurge: boolean;
  legalHold: boolean;
  lastChangedAt: string | null;
  lastChangedByEmail: string | null;
  lastChangeReason: string | null;
  lastChangeIncidentRef: string | null;
}
interface PurgeRun {
  id: string;
  runId: string;
  date: string;
  result: "success" | "partial" | "failed" | string;
  records: number;
  bytes: string;
  categories: string[];
  duration: string;
  note: string | null;
}
interface RecentRequest {
  id: string;
  patientName: string;
  patientMrn: string;
  patientEmail: string;
  type: "export" | "deletion" | string;
  status: RequestStatus | string;
  requestedAt: string;
}
interface RetentionData {
  buckets: Bucket[];
  override: Override;
  runs: PurgeRun[];
  nextRunAt: string;
  recentRequests: RecentRequest[];
  openRequestsCount: number;
}

function formatChangedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}`;
}

function formatRequestedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

export default function RetentionPage() {
  const [data, setData] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/compliance/retention", { cache: "no-store" });
      const j = (await r.json()) as RetentionData & { ok: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? "Could not load retention data.");
        return;
      }
      setData(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader
          eyebrow="Data retention"
          title="Lifecycle & right-of-access"
          description="Set tenant retention windows, manage scheduled purges, and approve patient export / deletion requests."
          actions={<SecurityBadge variant="audited" />}
        />
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading retention data…
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          eyebrow="Data retention"
          title="Lifecycle & right-of-access"
          description="Set tenant retention windows, manage scheduled purges, and approve patient export / deletion requests."
          actions={<SecurityBadge variant="audited" />}
        />
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-10 text-center text-sm text-[var(--color-danger)]">
          {error ?? "Retention data is unavailable."}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Data retention"
        title="Lifecycle & right-of-access"
        description="Set tenant retention windows, manage scheduled purges, and approve patient export / deletion requests."
        actions={<SecurityBadge variant="audited" />}
      />

      <BucketsCard buckets={data.buckets} onUpdated={load} />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <RecentRequestsCard requests={data.recentRequests} />
        <OverrideCard override={data.override} onUpdated={load} />
      </div>

      <PurgeRunsPanel runs={data.runs} nextRunAt={data.nextRunAt} paused={data.override.pausePurge} onRan={load} />
    </>
  );
}

function BucketsCard({ buckets, onUpdated }: { buckets: Bucket[]; onUpdated: () => void }) {
  const [editing, setEditing] = useState<Bucket | null>(null);
  const [retention, setRetention] = useState("");
  const [mode, setMode] = useState("scheduled");
  const [saving, setSaving] = useState(false);

  const open = (b: Bucket) => {
    setEditing(b);
    setRetention(b.retention);
    const inferredMode =
      b.deletion === "Cold-tier after 2y"
        ? "cold_tier_after_2y"
        : b.deletion === "Rolling"
          ? "rolling"
          : b.deletion === "Paused"
            ? "paused"
            : "scheduled";
    setMode(inferredMode);
  };

  const save = async () => {
    if (!editing) return;
    const label = retention.trim();
    if (!label) {
      toast.error("Retention label is required.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/compliance/retention", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: editing.key, retentionLabel: label, deletionMode: mode }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!r.ok || !j.ok) {
        toast.error(j.error ?? "Could not save.");
        return;
      }
      toast.success(`Retention updated for ${editing.name}`, {
        description: "Audit-logged · applies on next scheduled purge.",
      });
      setEditing(null);
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-semibold">Retention windows</h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Per-category retention configured by Compliance Manager. HIPAA enforces a 6-year minimum on audit logs.
        </p>
        <div className="mt-4 space-y-2">
          {buckets.map((b) => (
            <div
              key={b.key}
              className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] p-4"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                <Database className="size-4.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{b.name}</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">
                  {b.count} · purge {b.deletion.toLowerCase()}
                </p>
              </div>
              <Badge variant="muted" size="sm">
                <Clock /> {b.retention}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => open(b)}>
                <Edit /> Adjust
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust {editing?.name}</DialogTitle>
            <DialogDescription>
              Retention changes are audit-logged and applied on the next scheduled purge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ret-label">Retention window</Label>
              <Input
                id="ret-label"
                value={retention}
                onChange={(e) => setRetention(e.target.value)}
                placeholder="e.g. 7 years"
                maxLength={32}
              />
              <p className="text-[11px] text-[var(--color-muted-foreground)]">
                HIPAA mandates a 6-year minimum on audit logs and 7 years on clinical records.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ret-mode">Deletion mode</Label>
              <select
                id="ret-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm"
              >
                <option value="scheduled">Scheduled (daily purge)</option>
                <option value="cold_tier_after_2y">Cold-tier after 2y</option>
                <option value="rolling">Rolling (PITR)</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecentRequestsCard({ requests }: { requests: RecentRequest[] }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Patient data requests</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            HIPAA right-of-access · GDPR right-to-be-forgotten
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/compliance/deletion-requests">
            Open queue <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {requests.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-muted-foreground)]">
            No patient data requests yet.
          </p>
        )}
        {requests.map((r) => (
          <Link
            key={r.id}
            href={`/compliance/deletion-requests/${r.id}`}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-muted)]/40"
          >
            <span
              className={`flex size-9 items-center justify-center rounded-lg ${r.type === "export" ? "bg-[var(--color-info-soft)] text-[var(--color-info)]" : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"}`}
            >
              {r.type === "export" ? <Download className="size-4" /> : <Trash2 className="size-4" />}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {r.patientName} · {r.type === "export" ? "Export" : "Deletion"}
              </p>
              <p className="text-[11px] text-[var(--color-muted-foreground)]">
                {r.patientMrn} · {formatRequestedAt(r.requestedAt)}
              </p>
            </div>
            {r.status === "in_progress" && <Badge variant="info" size="sm" dot>In progress</Badge>}
            {r.status === "pending" && <Badge variant="warning" size="sm" dot>Pending</Badge>}
            {r.status === "approved_partial" && <Badge variant="success" size="sm" dot>Partial</Badge>}
            {r.status === "approved_full" && <Badge variant="success" size="sm" dot>Approved</Badge>}
            {r.status === "blocked" && <Badge variant="danger" size="sm" dot>Legal hold</Badge>}
            {r.status === "rejected" && <Badge variant="muted" size="sm">Rejected</Badge>}
          </Link>
        ))}
      </div>
    </div>
  );
}

function OverrideCard({ override, onUpdated }: { override: Override; onUpdated: () => void }) {
  const [pendingChange, setPendingChange] = useState<{ field: "pausePurge" | "legalHold"; value: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [incidentRef, setIncidentRef] = useState("");
  const [saving, setSaving] = useState(false);

  const askChange = (field: "pausePurge" | "legalHold", value: boolean) => {
    setReason("");
    setIncidentRef("");
    setPendingChange({ field, value });
  };

  const confirm = async () => {
    if (!pendingChange) return;
    if (!reason.trim()) {
      toast.error("Justification is required for overrides.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        reason: reason.trim(),
        incidentRef: incidentRef.trim() || undefined,
      };
      body[pendingChange.field] = pendingChange.value;
      const r = await fetch("/api/compliance/retention/overrides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!r.ok || !j.ok) {
        toast.error(j.error ?? "Could not save override.");
        return;
      }
      toast.success("Override updated", {
        description: "Audit-logged as a high-sensitivity event.",
      });
      setPendingChange(null);
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-semibold">Override controls</h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Overrides require justification and are audit-logged as high-sensitivity events.
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3">
            <div>
              <p className="text-sm font-medium">Pause scheduled purge</p>
              <p className="text-[11px] text-[var(--color-muted-foreground)]">Use only during investigations</p>
            </div>
            <Switch
              checked={override.pausePurge}
              onCheckedChange={(v) => askChange("pausePurge", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3">
            <div>
              <p className="text-sm font-medium">Block deletion (legal hold)</p>
              <p className="text-[11px] text-[var(--color-muted-foreground)]">
                Auto-applied to litigation cases
              </p>
            </div>
            <Switch
              checked={override.legalHold}
              onCheckedChange={(v) => askChange("legalHold", v)}
            />
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-[var(--color-warning-soft)]/30 p-3 text-xs text-[var(--color-muted-foreground)]">
          <AlertTriangle className="mr-1 inline-block size-3.5 text-[var(--color-warning)]" />
          {override.lastChangedAt ? (
            <>
              Last override:{" "}
              <span className="text-[var(--color-foreground)] font-medium">
                {formatChangedAt(override.lastChangedAt)}
                {override.lastChangedByEmail ? `, by ${override.lastChangedByEmail}` : ""}
              </span>
              {override.lastChangeIncidentRef ? ` · ${override.lastChangeIncidentRef}` : ""}
              {override.lastChangeReason ? (
                <p className="mt-1 italic text-[var(--color-muted-foreground)]/90">
                  &ldquo;{override.lastChangeReason}&rdquo;
                </p>
              ) : null}
            </>
          ) : (
            <>No overrides recorded yet.</>
          )}
        </div>
      </div>

      <Dialog open={!!pendingChange} onOpenChange={(o) => !o && setPendingChange(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingChange?.field === "pausePurge"
                ? pendingChange.value
                  ? "Pause scheduled purge?"
                  : "Resume scheduled purge?"
                : pendingChange?.value
                  ? "Enable legal hold?"
                  : "Disable legal hold?"}
            </DialogTitle>
            <DialogDescription>
              This is a high-sensitivity event. Provide a justification and (optionally) an incident
              reference. Both are written to the audit ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ov-reason">Justification</Label>
              <Input
                id="ov-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Investigation into anomaly cluster requires PHI preservation"
                maxLength={280}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-inc">Incident reference (optional)</Label>
              <Input
                id="ov-inc"
                value={incidentRef}
                onChange={(e) => setIncidentRef(e.target.value)}
                placeholder="INC-0014"
                maxLength={32}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingChange(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Confirm override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PurgeRunsPanel({
  runs,
  nextRunAt,
  paused,
  onRan,
}: {
  runs: PurgeRun[];
  nextRunAt: string;
  paused: boolean;
  onRan: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  const runNow = async () => {
    setRunning(true);
    try {
      const r = await fetch("/api/compliance/retention/purge-now", { method: "POST" });
      const j = (await r.json()) as {
        ok: boolean;
        error?: string;
        recordsPurged?: number;
        categories?: string[];
      };
      if (!r.ok || !j.ok) {
        toast.error(j.error ?? "Could not run purge.");
        return;
      }
      toast.success("Purge job complete", {
        description: `${(j.recordsPurged ?? 0).toLocaleString("en-IN")} records purged · ${(j.categories ?? []).join(", ") || "no categories"}`,
      });
      setConfirming(false);
      onRan();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Retention enforcement</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Daily purge job · runs at 02:00 UTC · honors active legal holds
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {paused && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/40 px-3 py-1 text-[11px] font-medium text-[oklch(0.45_0.14_75)] dark:text-[oklch(0.82_0.13_80)]">
              <ShieldAlert className="size-3" /> Purge paused
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-3 py-1 text-[11px] font-medium">
            <Clock className="size-3" /> Next run · {nextRunAt}
          </span>
          <Button size="sm" variant="outline" onClick={() => setConfirming(true)} disabled={paused}>
            <Trash2 /> Run purge now
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-[var(--color-muted)]/40 text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Run</th>
              <th className="px-4 py-2.5 text-left font-semibold">Result</th>
              <th className="px-4 py-2.5 text-left font-semibold">Records purged</th>
              <th className="px-4 py-2.5 text-left font-semibold">Categories</th>
              <th className="px-4 py-2.5 text-left font-semibold">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
                  No purge runs recorded yet for this tenant.
                </td>
              </tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs">{r.runId}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{r.date}</p>
                </td>
                <td className="px-4 py-3">
                  {r.result === "success" ? (
                    <Badge variant="success" size="sm" dot>Success</Badge>
                  ) : r.result === "partial" ? (
                    <Badge variant="warning" size="sm" dot>Partial</Badge>
                  ) : (
                    <Badge variant="danger" size="sm" dot>Failed</Badge>
                  )}
                  {r.note && (
                    <p className="mt-1 max-w-xs text-[10px] italic text-[var(--color-muted-foreground)]">
                      {r.note}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {r.records.toLocaleString("en-IN")} · {r.bytes}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.categories.map((c) => (
                      <Badge key={c} variant="muted" size="sm">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                  {r.duration}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-[var(--color-muted-foreground)]">
        Soft-deleted items hit the purge job after their category retention window lapses. Legal-hold
        flagged items skip the run and resurface on the next eligible day.
      </p>

      <Dialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Run purge job now?</DialogTitle>
            <DialogDescription>
              Off-cycle purges are heavily audited. Legal holds are honored. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={running}>
              Cancel
            </Button>
            <Button onClick={runNow} disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Run now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
