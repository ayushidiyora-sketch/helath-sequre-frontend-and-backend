import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Hourglass,
  Clock,
  User,
  ShieldCheck,
  ScrollText,
  Stethoscope,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  OPEN_APPROVALS,
  DECIDED_APPROVALS,
  getApproval,
  formatDuration,
} from "../approvals-data";
import { DecisionForm } from "./decision-form";

export function generateStaticParams() {
  return [...OPEN_APPROVALS, ...DECIDED_APPROVALS].map((r) => ({ id: r.id }));
}

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = getApproval(id);
  if (!r) notFound();

  const open = r.status === "open";
  const approved = r.status === "approved";

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/compliance/approvals"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Approvals
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">{r.id.toUpperCase()}</span>
      </div>

      {/* Header */}
      <div
        className={`overflow-hidden rounded-2xl border p-5 ${
          open
            ? "border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/20"
            : approved
              ? "border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/20"
              : "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-11 items-center justify-center rounded-xl bg-[var(--color-card)] ring-1 ${
                open
                  ? "text-[oklch(0.5_0.14_75)] ring-[var(--color-warning)]/30 dark:text-[oklch(0.85_0.13_80)]"
                  : approved
                    ? "text-[var(--color-success)] ring-[var(--color-success)]/30"
                    : "text-[var(--color-danger)] ring-[var(--color-danger)]/30"
              }`}
            >
              {open ? (
                <Hourglass className="size-5" />
              ) : approved ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <XCircle className="size-5" />
              )}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{r.requester}</h1>
                {open && <Badge variant="warning" size="sm" dot>Open</Badge>}
                {approved && <Badge variant="success" size="sm" dot>Approved</Badge>}
                {r.status === "rejected" && <Badge variant="danger" size="sm" dot>Rejected</Badge>}
                <Badge variant="info" size="sm">{r.flag}</Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
                <span className="inline-flex items-center gap-1"><Stethoscope className="size-3" /> {r.requesterRole}</span>
                <span className="inline-flex items-center gap-1"><Clock className="size-3" /> Requested {r.requestedAt}</span>
                {r.decidedAt && (
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="size-3" /> Decided {r.decidedAt} by {r.decidedBy}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subject facts */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Fact icon={User} label="Requester" value={r.requesterEmail} mono />
        <Fact icon={ShieldCheck} label="Target" value={r.patientLabel} />
        <Fact icon={Clock} label="Requested duration" value={formatDuration(r.durationHours)} />
      </div>

      {/* Reason */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="text-sm font-semibold">Reason for request</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {r.reason}
        </p>
      </div>

      {/* Requested scope */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <ScrollText className="size-4" /> Requested scope
        </h2>
        <ul className="mt-3 space-y-2">
          {r.scopeRequested.map((s) => (
            <li key={s} className="flex items-start gap-2.5 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
              <span className="text-[var(--color-muted-foreground)]">{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Decision: form for open, summary for decided */}
      {open ? (
        <DecisionForm request={r} />
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4" /> Decision record
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            {r.decisionNote ?? "No note recorded."}
          </p>
          <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
            {r.decidedBy} · {r.decidedAt} · audit-logged
          </p>
        </div>
      )}
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
      <p className={`mt-1 text-sm ${mono ? "font-mono break-all" : ""}`}>{value}</p>
    </div>
  );
}
