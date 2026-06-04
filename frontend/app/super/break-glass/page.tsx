"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Flame,
  Clock,
  ShieldAlert,
  Building2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";

/**
 * Super Admin → Break-glass page. Wires the form to a real backend:
 *   POST /api/super/break-glass    — initiate (validates, inserts, emails CM)
 *   POST /api/super/break-glass/[id]/close — close-early
 *   GET  /api/super/break-glass    — active session + recent sessions + tenants
 * The right-rail Active-session card shows a live countdown driven by
 * `expiresAt` from the API; when it hits 0 the page auto-refreshes and the
 * session flips to status=expired.
 */

interface Tenant {
  id: string;
  slug: string;
  name: string;
}
interface BgSession {
  id: string;
  displayId: string;
  operatorEmail: string;
  operatorName: string;
  isYou: boolean;
  targetOrgId: string;
  targetOrgSlug: string | null;
  targetOrgName: string | null;
  incidentRef: string | null;
  justification: string;
  status: string;
  startedAt: string;
  expiresAt: string;
  mfaChallengeAt: string;
  mfaVerifiedAt: string | null;
  closedAt: string | null;
  closeReason: string | null;
}
interface BgRead {
  id: string;
  sessionId: string;
  sessionDisplay: string;
  endpoint: string;
  queryParams: string | null;
  recordCount: number;
  readAt: string;
}
interface Payload {
  active: BgSession | null;
  recent: BgSession[];
  tenants: Tenant[];
  reads: BgRead[];
  serverNow: string;
}

function fmtUtc(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "UTC" })} · ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

function diffMmSs(future: number, now: number): string {
  let ms = Math.max(0, future - now);
  const m = Math.floor(ms / 60_000);
  ms -= m * 60_000;
  const s = Math.floor(ms / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

export default function BreakGlassPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [targetOrgId, setTargetOrgId] = useState<string>("");
  const [incidentRef, setIncidentRef] = useState<string>("INC-0021");
  const [justification, setJustification] = useState<string>("");
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [closing, setClosing] = useState<boolean>(false);
  const [closeOpen, setCloseOpen] = useState<boolean>(false);

  // +15m re-MFA challenge state
  const [mfaOpen, setMfaOpen] = useState<boolean>(false);
  const [mfaCode, setMfaCode] = useState<string>("");
  const [mfaSubmitting, setMfaSubmitting] = useState<boolean>(false);

  // Tag-read state (manual logger for PHI reads during the session)
  const [tagEndpoint, setTagEndpoint] = useState<string>("");
  const [tagQuery, setTagQuery] = useState<string>("");
  const [tagCount, setTagCount] = useState<string>("");
  const [tagSubmitting, setTagSubmitting] = useState<boolean>(false);

  // 1-second tick to drive the countdown
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/super/break-glass", { cache: "no-store" });
      const j = (await r.json()) as Payload & { ok: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? "Could not load break-glass data.");
        return;
      }
      setData(j);
      setError(null);
      if (!targetOrgId && j.tenants.length > 0) {
        setTargetOrgId(j.tenants[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [targetOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  // Drive a 1s tick whenever there's an active session so the countdown
  // updates in real time. Stop the timer when there's no active session.
  useEffect(() => {
    if (!data?.active) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    if (!tickRef.current) {
      tickRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [data?.active]);

  // When the local clock crosses `expiresAt`, refresh — the API will flip
  // the row to 'expired' via lazyExpire.
  useEffect(() => {
    if (!data?.active) return;
    const remaining = new Date(data.active.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      load();
      return;
    }
    const id = setTimeout(load, remaining + 200);
    return () => clearTimeout(id);
  }, [data?.active, load]);

  // +15m re-MFA: open the modal automatically once we pass `mfaChallengeAt`
  // and the operator hasn't verified yet. Close it if they verify. If they
  // skip past the 120s grace, the server lazyExpire sweep auto-closes the
  // session and the next refresh shows it as 'closed · mfa_timeout'.
  useEffect(() => {
    if (!data?.active) {
      if (mfaOpen) setMfaOpen(false);
      return;
    }
    if (data.active.mfaVerifiedAt) {
      if (mfaOpen) setMfaOpen(false);
      return;
    }
    const challengeMs = new Date(data.active.mfaChallengeAt).getTime();
    const now = Date.now();
    if (now >= challengeMs) {
      if (!mfaOpen) setMfaOpen(true);
    } else {
      // Schedule it for when we cross the boundary.
      const t = setTimeout(() => setMfaOpen(true), challengeMs - now + 200);
      return () => clearTimeout(t);
    }
  }, [data?.active, mfaOpen]);

  const initiate = async () => {
    if (justification.trim().length < 50) {
      toast.error("Justification must be at least 50 characters.");
      return;
    }
    if (!acknowledged) {
      toast.error("Please acknowledge the HIPAA / termination warning.");
      return;
    }
    if (!targetOrgId) {
      toast.error("Select a target tenant.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/super/break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetOrgId,
          incidentRef: incidentRef.trim() || undefined,
          justification: justification.trim(),
          acknowledged,
        }),
      });
      const j = (await r.json()) as { ok: boolean; displayId?: string; error?: string };
      if (!r.ok || !j.ok) {
        toast.error(j.error ?? "Could not start break-glass.");
        return;
      }
      toast.success(`Break-glass session ${j.displayId} started · 30:00 timer`, {
        description: "Compliance Manager notified · audit-logged",
      });
      setConfirming(false);
      setJustification("");
      setAcknowledged(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const close = async () => {
    if (!data?.active) return;
    setClosing(true);
    try {
      const r = await fetch(`/api/super/break-glass/${data.active.id}/close`, {
        method: "POST",
      });
      const j = (await r.json()) as { ok: boolean; displayId?: string; error?: string };
      if (!r.ok || !j.ok) {
        toast.error(j.error ?? "Could not close session.");
        return;
      }
      toast.success(`Session ${j.displayId} closed`, {
        description: "Post-mortem required within 24h.",
      });
      setCloseOpen(false);
      await load();
    } finally {
      setClosing(false);
    }
  };

  const tagRead = async () => {
    if (!data?.active) return;
    if (!tagEndpoint.trim()) {
      toast.error("Endpoint is required.");
      return;
    }
    setTagSubmitting(true);
    try {
      const r = await fetch(`/api/super/break-glass/${data.active.id}/tag-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: tagEndpoint.trim(),
          queryParams: tagQuery.trim() || undefined,
          recordCount: Number(tagCount) || 0,
        }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!r.ok || !j.ok) {
        toast.error(j.error ?? "Could not log read.");
        return;
      }
      toast.success("Read tagged", { description: "Visible on the linked incident's detail page." });
      setTagEndpoint("");
      setTagQuery("");
      setTagCount("");
      await load();
    } finally {
      setTagSubmitting(false);
    }
  };

  const submitMfa = async () => {
    if (!data?.active) return;
    if (!mfaCode.trim()) {
      toast.error("Enter your TOTP code or type CONFIRM.");
      return;
    }
    setMfaSubmitting(true);
    try {
      const r = await fetch(`/api/super/break-glass/${data.active.id}/mfa-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode.trim() }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!r.ok || !j.ok) {
        toast.error(j.error ?? "Verification failed.");
        return;
      }
      toast.success("MFA verified · session extended", {
        description: "You can continue reading until the 30-min window closes.",
      });
      setMfaOpen(false);
      setMfaCode("");
      await load();
    } finally {
      setMfaSubmitting(false);
    }
  };

  const charCount = justification.trim().length;
  const canSubmit = charCount >= 50 && acknowledged && !!targetOrgId && !data?.active;

  const remainingLabel = useMemo(() => {
    if (!data?.active) return "00:00";
    return diffMmSs(new Date(data.active.expiresAt).getTime(), Date.now());
  }, [data?.active]);
  const mfaLabel = useMemo(() => {
    if (!data?.active) return "—";
    return fmtUtc(data.active.mfaChallengeAt);
  }, [data?.active]);

  if (loading) {
    return (
      <>
        <PageHeader
          eyebrow="Break-glass"
          title="Exceptional PHI elevation"
          description="Use only for incident response. Every break-glass session is time-bounded, escalates to the tenant's Compliance Manager, and is recorded as a high-sensitivity event."
          actions={<SecurityBadge variant="audited" />}
        />
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading break-glass module…
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          eyebrow="Break-glass"
          title="Exceptional PHI elevation"
          description="Use only for incident response."
          actions={<SecurityBadge variant="audited" />}
        />
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-10 text-center text-sm text-[var(--color-danger)]">
          {error ?? "Break-glass module is unavailable."}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Break-glass"
        title="Exceptional PHI elevation"
        description="Use only for incident response. Every break-glass session is time-bounded, escalates to the tenant's Compliance Manager, and is recorded as a high-sensitivity event."
        actions={<SecurityBadge variant="audited" />}
      />

      <div className="overflow-hidden rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-card)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/30">
            <Flame className="size-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              This action grants you temporary PHI read access on the target tenant
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Break-glass is intended for active incident response only. Routine
              support requests must go through the tenant&apos;s own admin or compliance staff.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-[var(--color-muted-foreground)]">
              <li>• 30-minute session window (max)</li>
              <li>• Auto-notifies the tenant&apos;s Compliance Manager(s) via email</li>
              <li>
                • Every PHI read during the session is tagged{" "}
                <code className="font-mono">break_glass=true</code>
              </li>
              <li>• Post-mortem review required within 24 hours</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <ShieldAlert className="size-4 text-[var(--color-danger)]" /> Initiate break-glass session
          </h2>
          {data.active && (
            <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/30 p-3 text-xs">
              You already have an active session ({data.active.displayId}). Close it before opening a new one.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bg-target-tenant">Target tenant</Label>
              <div className="relative w-full">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-muted-foreground)] [&_svg]:size-4">
                  <Building2 />
                </span>
                <select
                  id="bg-target-tenant"
                  name="targetTenant"
                  value={targetOrgId}
                  onChange={(e) => setTargetOrgId(e.target.value)}
                  disabled={submitting || !!data.active}
                  className="flex h-10 w-full appearance-none rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] pl-10 pr-9 py-2 text-sm transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15 disabled:opacity-60"
                >
                  {data.tenants.length === 0 && <option value="">No tenants found</option>}
                  {data.tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.slug}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-muted-foreground)]">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-4">
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bg-incident">Linked incident</Label>
              <Input
                id="bg-incident"
                value={incidentRef}
                onChange={(e) => setIncidentRef(e.target.value)}
                placeholder="INC-0021"
                disabled={submitting || !!data.active}
                maxLength={32}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Session duration</Label>
              <Input defaultValue="30 min (max)" readOnly className="bg-[var(--color-muted)]" />
            </div>
            <div className="space-y-1.5">
              <Label>Re-MFA challenge</Label>
              <Input
                defaultValue="Required at start + 15m"
                readOnly
                className="bg-[var(--color-muted)]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bg-justification">
              Justification (required · 50 chars min · {charCount}/50)
            </Label>
            <Textarea
              id="bg-justification"
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Describe the incident, who requested elevation, and what data you expect to access…"
              disabled={submitting || !!data.active}
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={submitting || !!data.active}
            />
            <span>
              I acknowledge this action is audit-logged, notifies the tenant&apos;s Compliance
              Manager, and that misuse is grounds for termination and may constitute a HIPAA
              violation.
            </span>
          </label>
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            onClick={() => setConfirming(true)}
            disabled={!canSubmit || submitting}
          >
            <Flame /> Initiate break-glass
          </Button>
        </div>

        <div className="space-y-4">
          <div
            className={`rounded-2xl border p-5 ${data.active ? "border-[var(--color-danger)]/30" : "border-[var(--color-border)]"} bg-[var(--color-card)]`}
          >
            <div className="flex items-center justify-between">
              <p
                className={`text-xs font-semibold uppercase tracking-wider ${data.active ? "text-[var(--color-danger)]" : "text-[var(--color-muted-foreground)]"}`}
              >
                {data.active ? "Active session" : "No active session"}
              </p>
              {data.active && (
                <Badge variant="danger" size="sm" dot>
                  {data.active.displayId} · {remainingLabel}
                </Badge>
              )}
            </div>
            {data.active ? (
              <>
                <dl className="mt-3 space-y-2 text-xs">
                  <Row label="Operator" value={`${data.active.operatorName}${data.active.isYou ? " (you)" : ""}`} />
                  <Row label="Tenant" value={data.active.targetOrgSlug ?? data.active.targetOrgId} mono />
                  <Row label="Incident" value={data.active.incidentRef ?? "—"} mono />
                  <Row label="Time remaining" value={remainingLabel} mono />
                  <Row
                    label="Re-MFA"
                    value={
                      data.active.mfaVerifiedAt
                        ? `Verified · ${fmtUtc(data.active.mfaVerifiedAt)}`
                        : `Required at ${mfaLabel}`
                    }
                    mono
                  />
                </dl>
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => setCloseOpen(true)}
                  disabled={closing}
                >
                  Close session early
                </Button>
              </>
            ) : (
              <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
                Fill out the form on the left to open a session. You can only have one active
                break-glass at a time.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Auto-notifications sent on Initiate
            </p>
            <ul className="mt-3 space-y-2 text-[var(--color-muted-foreground)]">
              <li>• Tenant Compliance Manager(s) · email (best-effort via SendGrid / SMTP / Resend)</li>
              <li>• Anomaly engine · break-glass signature inserted into anomaly_decisions</li>
              <li>• Platform security stream · HIGH `break_glass.start` event</li>
              <li>• Audit ledger · 30-minute window stamped with operator + tenant + justification</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tag-read panel — only when there's an active session */}
      {data.active && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="text-sm font-semibold">Tag a PHI read</h2>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            After running a query (UI or direct SQL), log it here so the audit transcript on the
            linked incident shows what you accessed. Tagged reads carry{" "}
            <code className="font-mono">break_glass=true</code>.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
            <Input
              value={tagEndpoint}
              onChange={(e) => setTagEndpoint(e.target.value)}
              placeholder="e.g. /api/compliance/audit-logs"
              disabled={tagSubmitting}
              maxLength={240}
              className="font-mono"
            />
            <Input
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="query params (optional)"
              disabled={tagSubmitting}
              maxLength={240}
              className="font-mono"
            />
            <Input
              value={tagCount}
              onChange={(e) => setTagCount(e.target.value)}
              placeholder="rows read"
              disabled={tagSubmitting}
              type="number"
              min="0"
              className="font-mono"
            />
            <Button onClick={tagRead} disabled={tagSubmitting || !tagEndpoint.trim()}>
              {tagSubmitting ? <Loader2 className="animate-spin" /> : null} Log read
            </Button>
          </div>
        </div>
      )}

      {/* Reads list (this operator, last 30) */}
      {data.reads.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
            <h2 className="text-sm font-semibold">Your recent tagged reads</h2>
            <Badge variant="muted" size="sm">
              last {data.reads.length}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-[var(--color-muted)]/40 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">Session</th>
                  <th className="px-4 py-2 text-left">Endpoint</th>
                  <th className="px-4 py-2 text-right">Records</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.reads.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--color-muted)]/30">
                    <td className="px-4 py-2 text-[var(--color-muted-foreground)]">
                      {fmtUtc(r.readAt)}
                    </td>
                    <td className="px-4 py-2 font-mono">{r.sessionDisplay}</td>
                    <td className="px-4 py-2 font-mono text-[11px]">
                      {r.endpoint}
                      {r.queryParams ? `?${r.queryParams}` : ""}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{r.recordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
          <h2 className="text-sm font-semibold">Recent break-glass sessions</h2>
          <Badge variant="muted" size="sm">
            Audit · last {data.recent.length}
          </Badge>
        </div>
        {data.recent.length === 0 ? (
          <p className="p-6 text-center text-xs text-[var(--color-muted-foreground)]">
            No break-glass sessions on file yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {data.recent.map((r) => {
              const isActive = r.status === "active";
              const startedLabel = fmtUtc(r.startedAt);
              let durLabel: string;
              if (isActive) {
                durLabel = `Active · ${relTime(r.startedAt)}`;
              } else if (r.closedAt) {
                const ms = new Date(r.closedAt).getTime() - new Date(r.startedAt).getTime();
                const min = Math.max(1, Math.round(ms / 60_000));
                durLabel = `${min} min · ${r.closeReason ?? "closed"}`;
              } else {
                durLabel = "closed";
              }
              return (
                <li key={r.id} className="flex items-start gap-3 p-4">
                  <span
                    className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                      isActive
                        ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                        : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                    }`}
                  >
                    {isActive ? <Flame className="size-4" /> : <Clock className="size-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono text-xs">{r.displayId}</span>
                      <span className="font-semibold">{r.operatorName}</span>
                      <span className="text-[var(--color-muted-foreground)]">on</span>
                      <span className="font-mono text-xs">{r.targetOrgSlug ?? r.targetOrgId}</span>
                      {r.incidentRef && (
                        <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-[10px]">
                          {r.incidentRef}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-muted-foreground)] line-clamp-2">
                      {r.justification}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--color-muted-foreground)]">
                      Started {startedLabel} · {durLabel}
                    </p>
                  </div>
                  {isActive ? (
                    <Badge variant="danger" size="sm" dot>
                      Active
                    </Badge>
                  ) : r.status === "expired" ? (
                    <Badge variant="warning" size="sm">
                      Expired
                    </Badge>
                  ) : (
                    <Badge variant="muted" size="sm">
                      Closed
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Initiate confirm dialog */}
      <Dialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm break-glass elevation?</DialogTitle>
            <DialogDescription>
              30-min window will start immediately. Tenant Compliance Manager(s) will be
              emailed. This is a high-sensitivity audit event.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={initiate} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <Flame />} Authenticate &amp; elevate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close confirm dialog */}
      <Dialog open={closeOpen} onOpenChange={(o) => !o && setCloseOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close break-glass session early?</DialogTitle>
            <DialogDescription>
              Session {data.active?.displayId} will end immediately. Any required reads must be
              done now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)} disabled={closing}>
              Cancel
            </Button>
            <Button onClick={close} disabled={closing}>
              {closing ? <Loader2 className="animate-spin" /> : null} Close session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* +15m re-MFA challenge */}
      <Dialog open={mfaOpen} onOpenChange={(o) => !o && setMfaOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Re-MFA required · proof of presence</DialogTitle>
            <DialogDescription>
              15 minutes have passed since this session started. To continue, type your 6-digit
              TOTP code (or <code className="font-mono">CONFIRM</code> if your account has no
              authenticator enrolled). You have a 120-second grace period before the session
              auto-closes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="bg-mfa-code">TOTP code or CONFIRM</Label>
            <Input
              id="bg-mfa-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="123456"
              autoComplete="one-time-code"
              maxLength={32}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMfaOpen(false)} disabled={mfaSubmitting}>
              Skip (auto-close)
            </Button>
            <Button onClick={submitMfa} disabled={mfaSubmitting}>
              {mfaSubmitting ? <Loader2 className="animate-spin" /> : null} Verify &amp; extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className={`font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
