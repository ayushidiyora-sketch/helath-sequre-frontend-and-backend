import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  Download,
  Clock,
  User,
  Mail,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DELETION_REQUESTS,
  getDeletionRequest,
} from "../deletion-requests-data";
import { DecisionMatrix } from "../decision-matrix";

export function generateStaticParams() {
  return DELETION_REQUESTS.map((r) => ({ id: r.id }));
}

export default async function DeletionRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = getDeletionRequest(id);
  if (!r) notFound();

  const isExport = r.type === "export";
  const decided = r.status === "approved_partial" || r.status === "approved_full" || r.status === "rejected";

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/compliance/deletion-requests"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Patient data requests
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">{r.id.toUpperCase()}</span>
      </div>

      {/* Header */}
      <div
        className={`overflow-hidden rounded-2xl border p-5 ${
          r.legalHold
            ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20"
            : "border-[var(--color-border)] bg-[var(--color-card)]"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-11 items-center justify-center rounded-xl bg-[var(--color-card)] ring-1 ${
                isExport
                  ? "text-[var(--color-info)] ring-[var(--color-info)]/30"
                  : r.legalHold
                    ? "text-[var(--color-danger)] ring-[var(--color-danger)]/30"
                    : "text-[oklch(0.5_0.14_75)] ring-[var(--color-warning)]/30 dark:text-[oklch(0.85_0.13_80)]"
              }`}
            >
              {isExport ? <Download className="size-5" /> : r.legalHold ? <Lock className="size-5" /> : <Trash2 className="size-5" />}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  {isExport ? "Data export request" : "Data deletion request"} · {r.patientName}
                </h1>
                <Badge variant="info" size="sm">{isExport ? "Export" : "Deletion"}</Badge>
                {r.legalHold && <Badge variant="danger" size="sm" dot>Legal hold</Badge>}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
                <span className="inline-flex items-center gap-1"><Clock className="size-3" /> Requested {r.requestedAt}</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3" /> {r.channel}</span>
                {r.decidedAt && (
                  <span className="inline-flex items-center gap-1">Decided {r.decidedAt} by {r.decidedBy}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Patient facts */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Fact icon={User} label="Patient" value={`${r.patientName} · ${r.patientMrn}`} />
        <Fact icon={Mail} label="Contact" value={r.patientEmail} mono />
        <Fact icon={Clock} label="Channel" value={r.channel} />
      </div>

      {/* Either the live matrix (open) or the decision record (decided) */}
      {decided ? (
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
      ) : (
        <DecisionMatrix request={r} />
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
