"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Lightbulb,
  Loader2,
  Search as SearchIcon,
  XCircle,
} from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Outcome = "legitimate" | "policy_update" | "incident";
type DecisionStatus = "investigating" | "resolved" | "dismissed";

const OUTCOMES: Array<{
  key: Outcome;
  label: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  status: DecisionStatus;
}> = [
  {
    key: "legitimate",
    label: "Investigated — legitimate",
    helper: "Activity verified out-of-band. Dismissed with a recorded justification.",
    icon: CheckCircle2,
    status: "dismissed",
  },
  {
    key: "policy_update",
    label: "Tune detection rule",
    helper: "Pattern is acceptable; update the engine to stop flagging this signature.",
    icon: Lightbulb,
    status: "resolved",
  },
  {
    key: "incident",
    label: "Escalate — open incident",
    helper: "Likely real abuse. Page super admin, revoke session, file an incident record.",
    icon: ShieldAlert,
    status: "resolved",
  },
];

/**
 * Resolution dialog for an anomaly. Captures the outcome category and a
 * required written justification, both of which land in `anomaly_decisions`.
 * Replaces the bare "Dismiss" / "Open incident" buttons so every closure
 * carries its reason.
 */
export function ResolveAnomalyButton({
  anomalyId,
  variant = "outline",
  size = "sm",
  label = "Resolve…",
  className,
  onDone,
}: {
  anomalyId: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  label?: string;
  className?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("legitimate");
  const [coordinatedWith, setCoordinatedWith] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitDecision(targetStatus: DecisionStatus, outcomeKey: Outcome | null) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/compliance/anomalies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: anomalyId,
          status: targetStatus,
          outcome: outcomeKey,
          coordinatedWith: coordinatedWith.trim() || null,
          justification: justification.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        toast.error(json?.error ?? "Failed to save decision");
        return false;
      }
      return true;
    } catch {
      toast.error("Network error — please retry.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (!justification.trim()) {
      toast.warning("Justification required", {
        description: "Compliance closures must record a written reason.",
      });
      return;
    }
    const meta = OUTCOMES.find((o) => o.key === outcome)!;
    const ok = await submitDecision(meta.status, outcome);
    if (!ok) return;
    if (outcome === "incident") {
      toast.error("Incident opened", {
        description: `${anomalyId.slice(0, 24)}${anomalyId.length > 24 ? "…" : ""} · audit-logged`,
      });
    } else {
      toast.success(`Resolved · ${meta.label.toLowerCase()}`, {
        description: `${coordinatedWith ? "coordinated with " + coordinatedWith + " · " : ""}audit-logged`,
      });
    }
    setOpen(false);
    setJustification("");
    setCoordinatedWith("");
    setOutcome("legitimate");
    onDone?.();
    router.refresh();
  }

  async function quickInvestigate() {
    const ok = await submitDecision("investigating", null);
    if (!ok) return;
    toast.info("Marked as investigating", { description: "Status updated on the anomaly." });
    onDone?.();
    router.refresh();
  }

  async function quickDismiss() {
    if (!justification.trim()) {
      toast.warning("Justification required", {
        description: "Dismissing an anomaly still needs a written reason.",
      });
      return;
    }
    const ok = await submitDecision("dismissed", "legitimate");
    if (!ok) return;
    toast.success("Anomaly dismissed", { description: "audit-logged" });
    setOpen(false);
    setJustification("");
    setCoordinatedWith("");
    setOutcome("legitimate");
    onDone?.();
    router.refresh();
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <AlertTriangle className="size-5 text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]" />
              Resolve anomaly
            </DialogTitle>
            <DialogDescription>
              Pick the outcome and record the reason. The closure is written
              to the audit ledger and shown on the Closed tab.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Outcome</Label>
              <div className="space-y-2">
                {OUTCOMES.map((o) => {
                  const Icon = o.icon;
                  const active = outcome === o.key;
                  return (
                    <label
                      key={o.key}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${active ? "border-[var(--color-primary)] bg-[var(--color-primary-50)]/40" : "border-[var(--color-border)] hover:bg-[var(--color-muted)]/40"}`}
                    >
                      <input
                        type="radio"
                        name="outcome"
                        checked={active}
                        onChange={() => setOutcome(o.key)}
                        className="mt-1 size-4 accent-[var(--color-primary)]"
                      />
                      <Icon className={`mt-0.5 size-4 shrink-0 ${active ? "text-[var(--color-primary-700)]" : "text-[var(--color-muted-foreground)]"}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{o.label}</p>
                        <p className="text-[11px] text-[var(--color-muted-foreground)]">{o.helper}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="coordinated">Coordinated with (optional)</Label>
              <Input
                id="coordinated"
                placeholder="e.g. Mr. Patel (Org Admin), Dr. Verma, night-shift nurse"
                value={coordinatedWith}
                onChange={(e) => setCoordinatedWith(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="just-anomaly">Justification</Label>
              <Textarea
                id="just-anomaly"
                rows={4}
                placeholder="What did you verify, who confirmed it, why is this conclusion correct? Written into the audit ledger."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={quickInvestigate} disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <SearchIcon className="size-4" />}
                Mark investigating
              </Button>
              <Button variant="outline" onClick={quickDismiss} disabled={submitting}>
                <XCircle className="size-4" /> Dismiss
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
              <Button
                variant={outcome === "incident" ? "destructive" : "default"}
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : outcome === "incident" ? <ShieldAlert /> : <CheckCircle2 />}
                {outcome === "incident" ? "Open incident" : "Resolve"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
