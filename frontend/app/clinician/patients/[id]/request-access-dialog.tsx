"use client";

import * as React from "react";
import { toast } from "sonner";
import { Clock, Hourglass, ShieldCheck } from "lucide-react";
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
import {
  CONSENT_SCOPE_LABEL,
  useClinicianStore,
  type AssignedPatient,
  type ConsentScope,
} from "@/lib/clinician-store";

const ALL_SCOPES: ConsentScope[] = ["lab", "prescriptions", "notes", "imaging", "mental_health"];

const DEFAULT_REASON =
  "Covering Dr. Verma — patient escalated overnight. Need lab and imaging history to triage safely.";

export function RequestAccessDialog({
  open,
  onOpenChange,
  patient,
  initialScope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: AssignedPatient;
  initialScope?: ConsentScope;
}) {
  const { requestAccess } = useClinicianStore();

  const [scopes, setScopes] = React.useState<Record<ConsentScope, boolean>>(() =>
    Object.fromEntries(ALL_SCOPES.map((s) => [s, s === initialScope])) as Record<ConsentScope, boolean>,
  );
  const [duration, setDuration] = React.useState<number>(24);
  const [reason, setReason] = React.useState<string>("");

  // Reset when re-opened with a different initial scope.
  React.useEffect(() => {
    if (!open) return;
    setScopes(
      Object.fromEntries(ALL_SCOPES.map((s) => [s, s === initialScope])) as Record<ConsentScope, boolean>,
    );
    setDuration(24);
    setReason("");
  }, [open, initialScope]);

  const selectedScopes = ALL_SCOPES.filter((s) => scopes[s]);
  const canSubmit = reason.trim().length > 0 && selectedScopes.length > 0;

  function submit() {
    if (!canSubmit) return;
    requestAccess({
      patientId: patient.id,
      scopes: selectedScopes,
      durationHours: duration,
      reason: reason.trim(),
    });
    toast.success("Request submitted", {
      description: "Sai (Compliance Manager) notified · audit-logged",
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <ShieldCheck className="size-5 text-[var(--color-primary-700)]" />
            Request sensitive access · {patient.name}
          </DialogTitle>
          <DialogDescription>
            Compliance reviews every request. Approved access is time-bounded
            and audit-logged for the duration of the window.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Scopes requested</Label>
            <ul className="space-y-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
              {ALL_SCOPES.map((s) => (
                <li key={s}>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={scopes[s]}
                      onChange={(e) => setScopes({ ...scopes, [s]: e.target.checked })}
                      className="mt-0.5 size-4 rounded border-[var(--color-input)] accent-[var(--color-primary)]"
                    />
                    <span className={scopes[s] ? "" : "text-[var(--color-muted-foreground)]"}>
                      {CONSENT_SCOPE_LABEL[s]}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="duration-hours" className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> Duration · hours
            </Label>
            <Input
              id="duration-hours"
              type="number"
              min={1}
              max={168}
              value={duration}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                setDuration(Math.min(168, Math.max(1, Math.round(v))));
              }}
            />
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              1–168 hours (up to 7 days). Most clinical reviews fit in 24h.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="request-reason">Clinical justification</Label>
            <Textarea
              id="request-reason"
              rows={3}
              placeholder={DEFAULT_REASON}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              Required. Compliance sees this verbatim — be specific about why
              and for how long.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            <Hourglass /> Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
