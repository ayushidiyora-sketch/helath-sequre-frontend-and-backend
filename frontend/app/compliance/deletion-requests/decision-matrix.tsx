"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Lock,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import type {
  DeletionRequest,
  DataCategoryDecision,
} from "./deletion-requests-data";

type Disposition = DataCategoryDecision["defaultDisposition"];

const DISPO_META: Record<
  Disposition,
  { label: string; badge: "success" | "warning" | "info"; icon: React.ComponentType<{ className?: string }>; helper: string }
> = {
  delete: { label: "Delete", badge: "success", icon: Trash2, helper: "Purge from primary store + queue backup purge after PITR window." },
  keep: { label: "Retain", badge: "warning", icon: Lock, helper: "Keep until statutory window lapses. Patient will be informed why." },
  "export-only": { label: "Export only", badge: "info", icon: Download, helper: "Bundle into the export package; do not delete from store." },
};

/**
 * Interactive decision matrix for a GDPR / right-to-be-forgotten request.
 * Each data category starts with a retention-aware default disposition;
 * Compliance can override per row, then approve the partial-deletion
 * package with a written justification.
 */
export function DecisionMatrix({ request }: { request: DeletionRequest }) {
  const router = useRouter();
  const [decisions, setDecisions] = useState<Record<string, Disposition>>(
    Object.fromEntries(request.categories.map((c) => [c.key, c.defaultDisposition])),
  );
  const [note, setNote] = useState("");

  const summary = useMemo(() => {
    const counts = { delete: 0, keep: 0, "export-only": 0 } as Record<Disposition, number>;
    for (const d of Object.values(decisions)) counts[d] += 1;
    return counts;
  }, [decisions]);

  const isExport = request.type === "export";
  const someDelete = summary.delete > 0;
  const someKeep = summary.keep > 0;

  function setDisposition(key: string, d: Disposition) {
    setDecisions({ ...decisions, [key]: d });
  }

  function approve(kind: "partial" | "full" | "export") {
    if (!note.trim()) {
      toast.warning("Justification required", {
        description: "Document why each retained category is being kept and what was deleted.",
      });
      return;
    }
    if (kind === "export") {
      toast.success("Export bundle queued", {
        description: `${request.patientName} · PDF + CSV · audit-logged`,
      });
    } else {
      toast.success(kind === "full" ? "Full deletion approved" : "Partial deletion approved", {
        description: `Delete ${summary.delete} · Retain ${summary.keep} · ${request.patientName} notified · audit-logged`,
      });
    }
    router.push("/compliance/deletion-requests");
  }

  function reject() {
    if (!note.trim()) {
      toast.warning("Reason required", {
        description: "Rejections must record a reason for the requester.",
      });
      return;
    }
    toast.info("Request rejected", {
      description: `${request.patientName} · notified · audit-logged`,
    });
    router.push("/compliance/deletion-requests");
  }

  if (request.legalHold) {
    return (
      <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--color-danger)]" />
          <div>
            <h2 className="text-sm font-semibold">Blocked by legal hold</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              {request.legalHoldReason}
            </p>
            <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
              Resolve the legal hold from <span className="font-medium">Retention → Override controls</span> before processing this request.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4" /> Retention-aware decision matrix
        </h2>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Each category starts with the disposition allowed by the active retention policy. Override per row if needed; rejections must record a reason.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)]/40 text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Data category</th>
                <th className="px-3 py-2 text-left font-semibold">Retention policy</th>
                <th className="px-3 py-2 text-left font-semibold">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {request.categories.map((cat) => {
                const current = decisions[cat.key];
                const meta = DISPO_META[current];
                return (
                  <tr key={cat.key} className="align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium">{cat.label}</p>
                      <p className="text-[11px] text-[var(--color-muted-foreground)]">{cat.held}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--color-muted-foreground)]">
                      <p>{cat.retentionPolicy}</p>
                      <p className="mt-0.5 italic">{cat.reason}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(["delete", "keep", "export-only"] as Disposition[]).map((d) => {
                          const active = current === d;
                          const dm = DISPO_META[d];
                          const Icon = dm.icon;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDisposition(cat.key, d)}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors ${
                                active
                                  ? "border-[var(--color-primary)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                                  : "border-[var(--color-border)] hover:bg-[var(--color-muted)]/40"
                              }`}
                            >
                              <Icon className="size-3" /> {dm.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">{meta.helper}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tally */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-[var(--color-muted)]/30 px-3 py-2 text-xs">
          <Badge variant="success" size="sm"><Trash2 /> Delete · {summary.delete}</Badge>
          <Badge variant="warning" size="sm"><Lock /> Retain · {summary.keep}</Badge>
          <Badge variant="info" size="sm"><Download /> Export · {summary["export-only"]}</Badge>
          <span className="ml-auto text-[var(--color-muted-foreground)]">
            {someDelete && someKeep ? "Partial deletion · patient will be told what was kept and why." : someDelete ? "Full deletion across selected categories." : "Nothing scheduled for purge."}
          </span>
        </div>

        {/* Justification */}
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="note">Justification & patient-facing summary</Label>
          <Textarea
            id="note"
            rows={4}
            placeholder="Describe what is being deleted, what is being retained, and why. This is recorded in the audit ledger and forms the basis of the patient's notification."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {isExport ? (
            <Button size="sm" onClick={() => approve("export")}><Download /> Approve export</Button>
          ) : (
            <>
              <Button size="sm" onClick={() => approve(someKeep ? "partial" : "full")}>
                <CheckCircle2 /> {someKeep ? "Approve partial deletion" : "Approve full deletion"}
              </Button>
              <Button variant="destructive" size="sm" onClick={reject}>
                <XCircle /> Reject
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
