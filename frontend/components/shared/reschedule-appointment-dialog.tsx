"use client";

import { useState } from "react";
import { Calendar, Clock3, Loader2 } from "lucide-react";
import { toast } from "sonner";
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

/**
 * Reschedule dialog used by BOTH sides of the appointment lifecycle:
 *   - Clinician proposing a new slot from the patient chart (writes a
 *     reschedule_requested row that the patient can later accept/decline).
 *   - Patient changing the time of their own appointment before the
 *     clinician has confirmed it (writes the new startsAt directly and
 *     resets status to `requested`).
 *
 * The caller controls behavior via the `mode` prop and supplies an async
 * onSubmit({startsAt, note}) that handles the actual network call. The
 * dialog owns nothing but the form state + open/close.
 */
export function RescheduleAppointmentDialog({
  open,
  onOpenChange,
  currentStartsAt,
  currentLabel,
  clinicianName,
  mode,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** ISO timestamp of the appointment's current slot. */
  currentStartsAt: string;
  /** Optional pretty label e.g. "Wed Jun 3 · 3:30 PM". */
  currentLabel?: string;
  clinicianName?: string;
  mode: "clinician_propose" | "patient_request";
  onSubmit: (params: { startsAt: string; note: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const cur = new Date(currentStartsAt);
  // Default the picker to the existing slot + 1 day so the user always sees a
  // real candidate. The actual constraint is "any time in the future" — the
  // server validates.
  const initial = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  const [date, setDate] = useState<string>(
    `${initial.getFullYear()}-${String(initial.getMonth() + 1).padStart(2, "0")}-${String(initial.getDate()).padStart(2, "0")}`,
  );
  const [time, setTime] = useState<string>(
    `${String(initial.getHours()).padStart(2, "0")}:${String(initial.getMinutes()).padStart(2, "0")}`,
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
      toast.error("Pick a valid date and time.");
      return;
    }
    const startsAt = new Date(y, m - 1, d, hh, mm, 0, 0);
    if (Number.isNaN(startsAt.getTime())) {
      toast.error("Could not parse the picked slot.");
      return;
    }
    if (startsAt.getTime() <= Date.now()) {
      toast.error("Pick a slot in the future.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await onSubmit({ startsAt: startsAt.toISOString(), note: note.trim() });
      if (!res.ok) {
        toast.error(res.error ?? "Could not reschedule");
        return;
      }
      onOpenChange(false);
      setNote("");
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "clinician_propose"
    ? "Propose a new slot"
    : "Reschedule appointment";
  const description = mode === "clinician_propose"
    ? `The patient will be notified and can accept or decline the new time${clinicianName ? "" : ""}.`
    : "Pick a new slot. The clinician will be notified.";
  const buttonLabel = mode === "clinician_propose" ? "Send proposal" : "Request reschedule";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Calendar className="size-5" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-xs">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Current slot
            </p>
            <p className="mt-1 text-sm font-medium">
              {currentLabel ?? cur.toLocaleString("en-IN", { hour12: false })}
              {clinicianName ? ` · ${clinicianName}` : ""}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-date">New date</Label>
              <Input
                id="r-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-time">New time</Label>
              <Input
                id="r-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-note">Note (optional)</Label>
            <Textarea
              id="r-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "clinician_propose"
                  ? "Why are you proposing this slot? (recorded in the audit ledger)"
                  : "Anything the clinician should know about the new time?"
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Clock3 />}
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
