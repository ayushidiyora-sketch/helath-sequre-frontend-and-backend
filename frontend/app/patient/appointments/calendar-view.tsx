"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock3, Stethoscope, MapPin, Plus, CalendarX2 } from "lucide-react";
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

/** Appointments shown on the calendar (span Mar–Jun 2026). */
const EVENTS: Evt[] = [
  { id: "apt-8612", date: "2026-03-14", title: "Dermatology consult", time: "11:00 AM", clinician: "Dr. Neha Kapoor", location: "Room 212", kind: "past" },
  { id: "apt-8755", date: "2026-04-20", title: "General review", time: "3:00 PM", clinician: "Dr. Rohan Iyer", location: "Room 108", kind: "past" },
  { id: "apt-8841", date: "2026-05-12", title: "Cardiology consult", time: "9:30 AM", clinician: "Dr. Priya Shah", location: "Room 304", kind: "past" },
  { id: "apt-9081", date: "2026-05-25", title: "Cardiology follow-up", time: "9:30 – 9:45 AM", clinician: "Dr. Priya Shah", location: "Room 304", kind: "upcoming" },
  { id: "apt-9092", date: "2026-06-05", title: "Annual physical", time: "2:15 – 2:30 PM", clinician: "Dr. Rohan Iyer", location: "Telehealth", kind: "requested" },
];

const TODAY = new Date(2026, 4, 21); // demo "today" — 21 May 2026
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

/** Interactive month calendar for patient appointments. */
export function CalendarView() {
  const [view, setView] = useState({ y: TODAY.getFullYear(), m: TODAY.getMonth() });
  const [selected, setSelected] = useState(key(2026, 4, 25)); // May 25 selected by default

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cellCount = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const day = i - firstDow + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  const todayKey = key(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  const selectedEvents = EVENTS.filter((e) => e.date === selected);
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
    setView({ y: TODAY.getFullYear(), m: TODAY.getMonth() });
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
            const evt = EVENTS.find((e) => e.date === k);
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
                {evt && (
                  <div className="absolute inset-x-1 bottom-1 rounded-md bg-[var(--color-card)] px-2 py-1 shadow-[var(--shadow-soft)] ring-1 ring-inset ring-[var(--color-border)]">
                    <div className="flex items-center gap-1.5">
                      <span className={`size-1.5 shrink-0 rounded-full ${DOT[evt.kind]}`} />
                      <span className="truncate text-[10px] font-medium">{evt.title}</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side panel — selected day */}
      <div className="space-y-3">
        {selectedEvents.length > 0 ? (
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
