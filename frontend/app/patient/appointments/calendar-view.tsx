"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock3, Stethoscope, MapPin, Plus, CalendarX2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Evt {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  time: string;
  clinician: string;
  location: string;
  kind: "upcoming" | "requested" | "past";
}

/** Shape from GET /api/patient/appointments. */
interface DbAppt {
  id: string;
  clinicianName: string;
  clinicianDepartment: string;
  date: string;
  time: string;
  room: string | null;
  notes: string | null;
  status: string;
  mode: "in-person" | "telehealth";
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const key = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const DOT: Record<Evt["kind"], string> = {
  upcoming: "bg-[var(--color-primary)]",
  requested: "bg-[var(--color-warning)]",
  past: "bg-[var(--color-success)]",
};

const PAST_STATUSES = new Set(["completed", "cancelled", "no_show", "rejected"]);

function mapKind(status: string, dateStr: string, todayKey: string): Evt["kind"] {
  if (PAST_STATUSES.has(status)) return "past";
  if (status === "requested" || status === "reschedule_requested") return "requested";
  if (dateStr < todayKey) return "past";
  return "upcoming";
}

/** Interactive month calendar — shows the patient's real (DB) appointments. */
export function CalendarView() {
  const now = useMemo(() => new Date(), []);
  const todayKey = key(now.getFullYear(), now.getMonth(), now.getDate());

  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(todayKey);
  const [events, setEvents] = useState<Evt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/patient/appointments", { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        if (!alive || !data?.ok) return;
        const list = (data.appointments as DbAppt[]).map(
          (a): Evt => ({
            id: a.id,
            date: a.date,
            title: a.notes?.trim() || a.clinicianDepartment || "Appointment",
            time: a.time,
            clinician: a.clinicianName,
            location: a.room || (a.mode === "telehealth" ? "Telehealth" : `${a.clinicianDepartment} Wing`),
            kind: mapKind(a.status, a.date, todayKey),
          }),
        );
        setEvents(list);
        // If today has nothing, jump to the nearest upcoming appointment.
        if (!list.some((e) => e.date === todayKey)) {
          const upcoming = list
            .filter((e) => e.date >= todayKey)
            .sort((a, b) => a.date.localeCompare(b.date))[0];
          if (upcoming) {
            setSelected(upcoming.date);
            const [yy, mm] = upcoming.date.split("-").map(Number);
            setView({ y: yy, m: mm - 1 });
          }
        }
      } catch {
        /* keep empty calendar on error */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [todayKey]);

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cellCount = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const day = i - firstDow + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  const selectedEvents = events.filter((e) => e.date === selected);
  const selDate = (() => {
    const [y, m, d] = selected.split("-").map(Number);
    return `${MONTHS[m - 1]} ${d}, ${y}`;
  })();

  function shift(by: number) {
    setView((v) => {
      const m = v.m + by;
      if (m < 0) return { y: v.y - 1, m: 11 };
      if (m > 11) return { y: v.y + 1, m: 0 };
      return { y: v.y, m };
    });
  }
  function goToday() {
    setView({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(todayKey);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* Calendar grid */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Month view
            </p>
            <p className="text-lg font-semibold">
              {MONTHS[view.m]} {view.y}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => shift(-1)}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => shift(1)}>
              <ChevronRight />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-muted)]/30 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          {DOW.map((d) => (
            <div key={d} className="px-2 py-2.5">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            if (!d) {
              return <div key={i} className="min-h-24 border-b border-r border-[var(--color-border)] bg-[var(--color-muted)]/15" />;
            }
            const k = key(view.y, view.m, d);
            const dayEvents = events.filter((e) => e.date === k);
            const isSelected = k === selected;
            const isToday = k === todayKey;
            return (
              <button
                key={i}
                onClick={() => setSelected(k)}
                className={`relative min-h-24 border-b border-r border-[var(--color-border)] p-2 text-left text-xs transition-colors ${
                  isSelected ? "bg-[var(--color-primary-50)]/50 ring-1 ring-inset ring-[var(--color-primary)]" : "hover:bg-[var(--color-muted)]/40"
                }`}
              >
                <span
                  className={`inline-flex size-6 items-center justify-center rounded-full font-medium ${
                    isToday
                      ? "bg-[var(--color-primary)] text-white"
                      : isSelected
                        ? "text-[var(--color-primary-700)]"
                        : "text-[var(--color-foreground)]"
                  }`}
                >
                  {d}
                </span>
                {dayEvents.length > 0 && (
                  <div className="absolute inset-x-1 bottom-1 space-y-1">
                    {dayEvents.slice(0, 2).map((evt) => (
                      <div key={evt.id} className="rounded-md bg-[var(--color-card)] px-2 py-1 shadow-[var(--shadow-soft)] ring-1 ring-inset ring-[var(--color-border)]">
                        <div className="flex items-center gap-1.5">
                          <span className={`size-1.5 shrink-0 rounded-full ${DOT[evt.kind]}`} />
                          <span className="truncate text-[10px] font-medium">{evt.title}</span>
                        </div>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="px-1 text-[9px] font-medium text-[var(--color-muted-foreground)]">+{dayEvents.length - 2} more</p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side panel — selected day */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : selectedEvents.length > 0 ? (
          selectedEvents.map((e) => (
            <div key={e.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Selected · {selDate}
              </p>
              <p className="mt-1 text-lg font-semibold">{e.title}</p>
              <div className="mt-3 space-y-2 text-xs text-[var(--color-muted-foreground)]">
                <div className="inline-flex items-center gap-2"><Clock3 className="size-3.5" /> {e.time}</div>
                <div className="inline-flex items-center gap-2"><Stethoscope className="size-3.5" /> {e.clinician}</div>
                <div className="inline-flex items-center gap-2"><MapPin className="size-3.5" /> {e.location}</div>
              </div>
              <Button asChild size="sm" className="mt-4 w-full">
                <Link href={`/patient/appointments/${e.id}`}>View details</Link>
              </Button>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
              <CalendarX2 className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium">No appointments</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">Nothing scheduled for {selDate}.</p>
          </div>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href="/patient/appointments/new"><Plus /> Book new</Link>
        </Button>
      </div>
    </div>
  );
}
