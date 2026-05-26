import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  ScrollText,
  Shield,
  Globe,
  User,
  Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/shared/action-button";
import { OPEN_ANOMALIES, getAnomaly } from "../anomalies-data";
import { ResolveAnomalyButton } from "../resolve-anomaly";

export function generateStaticParams() {
  return OPEN_ANOMALIES.map((a) => ({ id: a.id }));
}

export default async function AnomalyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = getAnomaly(id);
  if (!a) notFound();

  const high = a.sev === "high";

  return (
    <>
      {/* Breadcrumb */}
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

      {/* Header */}
      <div
        className={`overflow-hidden rounded-2xl border p-5 ${
          high
            ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20"
            : "border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/20"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-11 items-center justify-center rounded-xl bg-[var(--color-card)] ring-1 ${
                high
                  ? "text-[var(--color-danger)] ring-[var(--color-danger)]/30"
                  : "text-[oklch(0.5_0.14_75)] ring-[var(--color-warning)]/30 dark:text-[oklch(0.85_0.13_80)]"
              }`}
            >
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{a.title}</h1>
                {high ? (
                  <Badge variant="danger" size="sm" dot>High</Badge>
                ) : (
                  <Badge variant="warning" size="sm" dot>Medium</Badge>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
                <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {a.detectedAt}</span>
                <span className="inline-flex items-center gap-1"><ScrollText className="size-3" /> {a.events} events</span>
                <span className="inline-flex items-center gap-1"><Shield className="size-3" /> Anomaly engine v2</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              variant="outline"
              size="sm"
              href="/compliance/audit-logs"
              toastMessage={`Filtering ledger to ${a.events} events`}
              toastVariant="info"
            >
              <ScrollText /> View events
            </ActionButton>
            <ResolveAnomalyButton anomalyId={a.id} label="Resolve…" />
          </div>
        </div>
      </div>

      {/* Subject */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Fact icon={User} label="Actor" value={a.actor} mono />
        <Fact icon={Globe} label="Source IP" value={a.ip} mono />
        <Fact icon={Clock} label="Time window" value={a.window} />
      </div>

      {/* What happened */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="text-sm font-semibold">What happened</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {a.description}
        </p>
      </div>

      {/* Evidence */}
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

      {/* Recommended action */}
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
    </>
  );
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
