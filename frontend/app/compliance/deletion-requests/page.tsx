import Link from "next/link";
import {
  Trash2,
  Download,
  Clock,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DELETION_REQUESTS, type DeletionRequest } from "./deletion-requests-data";

export default function DeletionRequestsPage() {
  const open = DELETION_REQUESTS.filter((r) =>
    ["pending", "in_progress", "blocked"].includes(r.status),
  );
  const decided = DELETION_REQUESTS.filter((r) =>
    ["approved_partial", "approved_full", "rejected"].includes(r.status),
  );

  return (
    <>
      <PageHeader
        eyebrow="Patient data requests"
        title="Right-of-access · right-to-be-forgotten"
        description="Patient-initiated export and deletion requests. Each one is reviewed against the active retention policy; full deletion is rare because HIPAA mandates minimum windows."
      />

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open · {open.length}</TabsTrigger>
          <TabsTrigger value="decided">Decided · {decided.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <div className="space-y-4">
            {open.map((r) => <Row key={r.id} r={r} />)}
          </div>
        </TabsContent>

        <TabsContent value="decided">
          <div className="space-y-4">
            {decided.map((r) => <Row key={r.id} r={r} />)}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Row({ r }: { r: DeletionRequest }) {
  const isExport = r.type === "export";
  return (
    <div
      className={`overflow-hidden rounded-2xl border p-5 ${
        r.legalHold
          ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20"
          : r.status === "approved_partial" || r.status === "approved_full"
            ? "border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/20"
            : r.status === "rejected"
              ? "border-[var(--color-muted)] bg-[var(--color-card)]"
              : "border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/20"
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
              <h3 className="text-base font-semibold">{r.patientName}</h3>
              {r.legalHold && <Badge variant="danger" size="sm" dot>Legal hold</Badge>}
              {r.status === "pending" && <Badge variant="warning" size="sm" dot>Pending review</Badge>}
              {r.status === "in_progress" && <Badge variant="info" size="sm" dot>In progress</Badge>}
              {r.status === "approved_partial" && <Badge variant="success" size="sm" dot>Partial deletion</Badge>}
              {r.status === "approved_full" && <Badge variant="success" size="sm" dot>Full deletion</Badge>}
              {r.status === "rejected" && <Badge variant="muted" size="sm">Rejected</Badge>}
              <Badge variant="info" size="sm">{isExport ? "Export" : "Deletion"}</Badge>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {r.patientMrn} · {r.patientEmail}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
              <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {r.requestedAt}</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3" /> {r.channel}</span>
              {r.legalHold && (
                <span className="inline-flex items-center gap-1 text-[var(--color-danger)]"><AlertTriangle className="size-3" /> Blocked by litigation hold</span>
              )}
              {r.decidedAt && (
                <span className="inline-flex items-center gap-1">Decided {r.decidedAt} by {r.decidedBy}</span>
              )}
            </div>
            {r.decisionNote && (
              <p className="mt-2 max-w-2xl text-[11px] italic text-[var(--color-muted-foreground)]/90">
                {r.decisionNote}
              </p>
            )}
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={`/compliance/deletion-requests/${r.id}`}>{r.status === "pending" ? "Review" : "View"} <ArrowRight /></Link>
        </Button>
      </div>
    </div>
  );
}
