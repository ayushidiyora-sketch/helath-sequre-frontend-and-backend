import Link from "next/link";
import {
  Hourglass,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ScrollText,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import {
  OPEN_APPROVALS,
  DECIDED_APPROVALS,
  formatDuration,
  type ApprovalRequest,
} from "./approvals-data";

export default function ApprovalsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Approvals"
        title="Sensitive-access requests"
        description="Staff asking to read PHI outside their default scope. Each open request needs a decision: approve (with optional conditions), reject, or request more information."
      />

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open · {OPEN_APPROVALS.length}</TabsTrigger>
          <TabsTrigger value="decided">Decided · {DECIDED_APPROVALS.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <div className="space-y-4">
            {OPEN_APPROVALS.map((r) => (
              <OpenRow key={r.id} r={r} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="decided">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <ul className="divide-y divide-[var(--color-border)]">
              {DECIDED_APPROVALS.map((r) => (
                <DecidedRow key={r.id} r={r} />
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function OpenRow({ r }: { r: ApprovalRequest }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-card)] text-[oklch(0.5_0.14_75)] ring-1 ring-[var(--color-warning)]/30 dark:text-[oklch(0.85_0.13_80)]">
            <Hourglass className="size-5" />
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{r.requester}</h3>
              <Badge variant="warning" size="sm" dot>{r.flag}</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {r.patientLabel} · {r.requesterRole}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-[var(--color-foreground)]/85">
              {r.reason}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
              <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {r.requestedAt}</span>
              <span className="inline-flex items-center gap-1"><ScrollText className="size-3" /> {r.scopeRequested.length} scope item{r.scopeRequested.length === 1 ? "" : "s"}</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3" /> Duration · {formatDuration(r.durationHours)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href={`/compliance/approvals/${r.id}`}>Review <ArrowRight /></Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function DecidedRow({ r }: { r: ApprovalRequest }) {
  const approved = r.status === "approved";
  return (
    <li className="flex items-start gap-3 p-4">
      <span className={approved ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
        {approved ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{r.requester}</p>
          <Badge variant={approved ? "success" : "danger"} size="sm" dot>
            {approved ? "Approved" : "Rejected"}
          </Badge>
        </div>
        <p className="text-[11px] text-[var(--color-muted-foreground)]">
          {r.patientLabel} · decided {r.decidedAt} by {r.decidedBy}
        </p>
        {r.decisionNote && (
          <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]/90 italic">
            <User className="mr-1 inline size-3" />
            {r.decisionNote}
          </p>
        )}
      </div>
      <Button asChild variant="ghost" size="sm">
        <Link href={`/compliance/approvals/${r.id}`}>View</Link>
      </Button>
    </li>
  );
}
