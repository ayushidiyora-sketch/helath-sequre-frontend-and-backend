"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  ScrollText,
  Shield,
  Globe,
  User,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/shared/action-button";
import { decodeSigBrowser } from "@/lib/anomaly-sig";
import { ResolveAnomalyButton } from "../resolve-anomaly";

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

function sevPills(sev: Severity) {
  if (sev === "critical") return <Badge variant="danger" size="sm" dot>Critical</Badge>;
  if (sev === "high")     return <Badge variant="danger" size="sm" dot>High</Badge>;
  if (sev === "medium")   return <Badge variant="warning" size="sm" dot>Medium</Badge>;
  return <Badge variant="muted" size="sm" dot>Low</Badge>;
}

export default function AnomalyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const signature = decodeSigBrowser(id);

  const [anomaly, setAnomaly] = useState<Anomaly | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/compliance/anomalies", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        const list: Anomaly[] = json?.anomalies ?? [];
        const found = list.find((a) => a.signature === signature) ?? null;
        if (!found) setMissing(true);
        setAnomaly(found);
      } catch (err) { console.error("[anomaly detail] fetch", err); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [signature, reloadKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading investigation…
      </div>
    );
  }

  if (missing || !anomaly) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Link
            href="/compliance/anomalies"
            className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
          >
            <ArrowLeft className="size-3.5" /> Anomalies
          </Link>
        </div>
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
          This anomaly no longer matches the detector rules — it may have been resolved or aged out of the lookback window.
        </div>
      </div>
    );
  }

  const a = anomaly;
  const isCritical = a.severity === "critical";
  const isHigh = a.severity === "high" || isCritical;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/compliance/anomalies"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Anomalies
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">Investigation</span>
      </div>

      <div
        className={`overflow-hidden rounded-2xl border p-5 ${
          isCritical
            ? "border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]/30"
            : isHigh
              ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20"
              : a.severity === "medium"
                ? "border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/20"
                : "border-[var(--color-border)] bg-[var(--color-card)]"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-11 items-center justify-center rounded-xl bg-[var(--color-card)] ring-1 ${
                isHigh
                  ? "text-[var(--color-danger)] ring-[var(--color-danger)]/30"
                  : a.severity === "medium"
                    ? "text-[oklch(0.5_0.14_75)] ring-[var(--color-warning)]/30 dark:text-[oklch(0.85_0.13_80)]"
                    : "text-[var(--color-muted-foreground)] ring-[var(--color-border)]"
              }`}
            >
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{a.title}</h1>
                {sevPills(a.severity)}
                {a.status === "investigating" && <Badge variant="info" size="sm" dot>Investigating</Badge>}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
                <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {new Date(a.detectedAt).toLocaleString("en-IN", { hour12: false })}</span>
                <span className="inline-flex items-center gap-1"><ScrollText className="size-3" /> {a.events} events</span>
                <span className="inline-flex items-center gap-1"><Shield className="size-3" /> Anomaly engine v2</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              variant="outline"
              size="sm"
              href={`/compliance/audit-logs?${new URLSearchParams({ q: a.actor }).toString()}`}
              toastMessage={`Filtering ledger by ${a.actor}`}
              toastVariant="info"
            >
              <ScrollText /> View events
            </ActionButton>
            <ResolveAnomalyButton
              anomalyId={a.signature}
              label="Resolve…"
              onDone={() => setReloadKey((k) => k + 1)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Fact icon={User} label="Actor" value={a.actor} mono />
        <Fact icon={Globe} label="Source IP" value={a.ip} mono />
        <Fact icon={Clock} label="Time window" value={a.window} />
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="text-sm font-semibold">What happened</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {a.description}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <ScrollText className="size-4" /> Evidence
        </h2>
        <ul className="mt-3 space-y-2">
          {a.evidence.map((e) => (
            <li key={e} className="flex items-start gap-2.5 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
              <span className="text-[var(--color-muted-foreground)]">{e}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-50)]/40 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-card)] text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary)]/20">
            <Lightbulb className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Recommended action</p>
            <p className="mt-0.5 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              {a.recommendation}
            </p>
          </div>
        </div>
      </div>

      {a.decision && (a.decision.justification || a.decision.outcome || a.decision.decidedByEmail) && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="text-sm font-semibold">Reviewer decision</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Datum label="Outcome" value={prettyOutcome(a.decision.outcome)} />
            <Datum label="Decided by" value={a.decision.decidedByEmail ?? "—"} />
            <Datum label="Coordinated with" value={a.decision.coordinatedWith ?? "—"} />
            <Datum label="Decided at" value={a.decision.decidedAt ? new Date(a.decision.decidedAt).toLocaleString("en-IN", { hour12: false }) : "—"} />
          </dl>
          {a.decision.justification && (
            <p className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-sm italic text-[var(--color-muted-foreground)]">
              {a.decision.justification}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function prettyOutcome(o: string | null | undefined) {
  if (o === "legitimate") return "Investigated — legitimate";
  if (o === "policy_update") return "Detection rule tuned";
  if (o === "incident") return "Escalated — incident opened";
  return "—";
}

function Fact({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <Icon className="size-3" /> {label}
      </p>
      <p className={`mt-1 text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
