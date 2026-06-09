"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * In-app appointment reminder popup. Polls the signed-in user's upcoming
 * appointments and, when one starts within the next hour (T-1h), pops a dialog.
 * Mounted in BOTH the patient and clinician layouts so each side gets reminded.
 *
 * Dismissals are remembered per appointment in localStorage so the popup doesn't
 * reappear on every poll / navigation. This is the live UX layer on top of the
 * `appointment_reminders` rows + cron email dispatch.
 */

type Role = "patient" | "clinician";

interface ApptLite {
  id: string;
  startsAt: string;
  status: string;
  who: string;
  sub: string;
  telehealth: boolean;
}

type ReminderKind = "t_1h" | "t_24h";

interface Due {
  key: string; // `${id}:${kind}`
  kind: ReminderKind;
  appt: ApptLite;
}

const DISMISS_KEY = "hs_appt_reminders_dismissed";
const POLL_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * 60;
// Active (not closed) statuses — DB enum form (underscored).
const ACTIVE = new Set(["requested", "reschedule_requested", "confirmed", "arrived"]);

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(DISMISS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveDismissed(s: Set<string>): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...s]));
  } catch {
    // ignore
  }
}
function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

interface ApiAppt {
  id: string;
  startsAt: string;
  status: string;
  clinicianName?: string;
  clinicianDepartment?: string;
  patientName?: string | null;
  room?: string | null;
  mode?: string;
}

export function AppointmentReminder({ role }: { role: Role }) {
  const [due, setDue] = useState<Due | null>(null);
  const dismissed = useRef<Set<string>>(new Set());

  useEffect(() => {
    dismissed.current = loadDismissed();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const url =
          role === "patient"
            ? "/api/patient/appointments"
            : `/api/clinician/appointments?from=${ymd(0)}&to=${ymd(2)}`;
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { ok?: boolean; appointments?: ApiAppt[] };
        if (cancelled || !data?.ok || !Array.isArray(data.appointments)) return;

        const now = Date.now();
        let best: Due | null = null;
        for (const a of data.appointments) {
          if (!ACTIVE.has(a.status)) continue;
          const start = Date.parse(a.startsAt);
          if (Number.isNaN(start) || start <= now) continue;
          const mins = (start - now) / 60_000;
          // Within the next hour → T-1h reminder; otherwise within the next day
          // → T-24h reminder. The two have separate dismissal keys so dismissing
          // the day-before nudge doesn't suppress the hour-before one.
          let kind: ReminderKind;
          if (mins <= HOUR_MINUTES) kind = "t_1h";
          else if (mins <= DAY_MINUTES) kind = "t_24h";
          else continue;
          const key = `${a.id}:${kind}`;
          if (dismissed.current.has(key)) continue;
          const appt: ApptLite = {
            id: a.id,
            startsAt: a.startsAt,
            status: a.status,
            who:
              role === "patient"
                ? a.clinicianName || "your clinician"
                : a.patientName || "your patient",
            sub:
              role === "patient"
                ? a.clinicianDepartment || ""
                : a.room === "Telehealth"
                  ? "Telehealth"
                  : "In-person",
            telehealth: (a.room ?? a.mode) === "Telehealth" || a.mode === "telehealth",
          };
          if (!best || start < Date.parse(best.appt.startsAt)) best = { key, kind, appt };
        }
        if (!cancelled) setDue(best);
      } catch {
        // network blip — try again next tick
      }
    }

    void check();
    const t = window.setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [role]);

  if (!due) return null;

  const start = new Date(due.appt.startsAt);
  const minsLeft = Math.max(1, Math.round((start.getTime() - Date.now()) / 60_000));
  const hoursLeft = Math.max(1, Math.round(minsLeft / 60));
  const timeLabel = start.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const headline =
    due.kind === "t_1h" ? `Appointment in ${minsLeft} min` : `Appointment in ~${hoursLeft} hours`;
  const href =
    role === "patient"
      ? `/patient/appointments/${due.appt.id}`
      : `/clinician/appointments/${due.appt.id}`;

  function dismiss() {
    dismissed.current.add(due!.key);
    saveDismissed(dismissed.current);
    setDue(null);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
            <CalendarClock className="size-6" />
          </div>
          <DialogTitle className="text-center">{headline}</DialogTitle>
          <DialogDescription className="text-center">
            {due.kind === "t_1h"
              ? `Your appointment with ${due.appt.who} is coming up.`
              : `Reminder: your appointment with ${due.appt.who} is coming up soon.`}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4 text-center">
          <p className="text-sm font-semibold">{due.appt.who}</p>
          {due.appt.sub && (
            <p className="text-xs text-[var(--color-muted-foreground)]">{due.appt.sub}</p>
          )}
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium">
            <Clock className="size-3.5" /> {timeLabel}
          </p>
          {due.appt.telehealth && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
              <MapPin className="size-3" /> Telehealth · join from the appointment page
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={dismiss}>Dismiss</Button>
          <Button asChild onClick={dismiss}>
            <Link href={href}>View appointment</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
