"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  X,
  MessageSquare,
  ShieldCheck,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApprovalRequest } from "../approvals-data";
import { formatDuration } from "../approvals-data";

type Mode = "idle" | "approve" | "reject" | "info";

/**
 * Decision panel for an open access-approval request. Compliance can
 * approve with conditions (scope narrowing + duration shortening +
 * justification), reject with a reason, or send the request back to the
 * requester asking for more information.
 */
export function DecisionForm({ request }: { request: ApprovalRequest }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [scope, setScope] = useState<Record<string, boolean>>(
    Object.fromEntries(request.scopeRequested.map((s) => [s, true])),
  );
  const [duration, setDuration] = useState<number>(request.durationHours);
  const [justification, setJustification] = useState("");

  const approvedScope = Object.entries(scope)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const narrowed =
    approvedScope.length < request.scopeRequested.length ||
    duration < request.durationHours;

  function submitApprove() {
    if (!justification.trim()) {
      toast.warning("Justification required", {
        description: "Compliance decisions must record a written reason.",
      });
      return;
    }
    if (approvedScope.length === 0) {
      toast.warning("Empty scope", {
        description: "Approve at least one scope item, or reject the request.",
      });
      return;
    }
    toast.success(
      narrowed
        ? `${request.requester} · approved with conditions`
        : `${request.requester} · approved`,
      {
        description: `Scope: ${approvedScope.length}/${request.scopeRequested.length} items · ${formatDuration(duration)} · audit-logged`,
      },
    );
    setMode("idle");
    router.push("/compliance/approvals");
  }

  function submitReject() {
    if (!justification.trim()) {
      toast.warning("Reason required", {
        description: "Rejections must record a reason for the requester.",
      });
      return;
    }
    toast.info("Request rejected", {
      description: `${request.requester} · notified · audit-logged`,
    });
    setMode("idle");
    router.push("/compliance/approvals");
  }

  function submitInfo() {
    if (!justification.trim()) {
      toast.warning("Message required", {
        description: "Tell the requester what additional information is needed.",
      });
      return;
    }
    toast.info("More info requested", {
      description: `${request.requester} · message sent`,
    });
    setMode("idle");
    router.push("/compliance/approvals");
  }

  return (
    <>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4" /> Decision
        </h2>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Approving creates a time-bounded consent grant. Every access during
          the window is flagged in the audit trail.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setMode("approve")}>
            <Check /> Approve…
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode("info")}>
            <MessageSquare /> Request more info
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setMode("reject")}>
            <X /> Reject…
          </Button>
        </div>
      </div>

      {/* Approve with conditions */}
      <Dialog open={mode === "approve"} onOpenChange={(o) => !o && setMode("idle")}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <ShieldCheck className="size-5 text-[var(--color-primary-700)]" />
              Approve with conditions
            </DialogTitle>
            <DialogDescription>
              Trim the scope or duration before granting access. The
              requester sees only what you approve here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Approved scope</Label>
              <ul className="space-y-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
                {request.scopeRequested.map((s) => (
                  <li key={s}>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={scope[s]}
                        onChange={(e) => setScope({ ...scope, [s]: e.target.checked })}
                        className="mt-0.5 size-4 rounded border-[var(--color-input)] accent-[var(--color-primary)]"
                      />
                      <span className={scope[s] ? "" : "text-[var(--color-muted-foreground)] line-through"}>{s}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="duration" className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" /> Duration · hours
              </Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={request.durationHours}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
              />
              <p className="text-[11px] text-[var(--color-muted-foreground)]">
                Requested {formatDuration(request.durationHours)} · approving {formatDuration(duration)}
                {duration < request.durationHours && " (narrowed)"}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="just-approve">Justification</Label>
              <Textarea
                id="just-approve"
                rows={3}
                placeholder="Why is this access necessary? Recorded in the audit ledger and visible to the patient on request."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode("idle")}>Cancel</Button>
            <Button onClick={submitApprove}>
              <Check /> {narrowed ? "Approve with conditions" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={mode === "reject"} onOpenChange={(o) => !o && setMode("idle")}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <AlertTriangle className="size-5 text-[var(--color-danger)]" />
              Reject this request
            </DialogTitle>
            <DialogDescription>
              The requester is notified with your reason. No access is
              granted; the request is closed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            <Label htmlFor="just-reject">Reason for rejection</Label>
            <Textarea
              id="just-reject"
              rows={3}
              placeholder="Briefly explain why — e.g. scope not covered under existing consent, requester should use a different process, etc."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode("idle")}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject}><X /> Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request more info */}
      <Dialog open={mode === "info"} onOpenChange={(o) => !o && setMode("idle")}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <MessageSquare className="size-5 text-[var(--color-primary-700)]" />
              Ask the requester for more information
            </DialogTitle>
            <DialogDescription>
              The request stays open. Your message is sent to the requester
              and recorded on the request thread.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            <Label htmlFor="just-info">Message</Label>
            <Textarea
              id="just-info"
              rows={3}
              placeholder="What do you need clarified? e.g. confirm Dr. Verma's leave dates, attach the referral note, narrow the scope, etc."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode("idle")}>Cancel</Button>
            <Button onClick={submitInfo}><MessageSquare /> Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
