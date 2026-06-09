"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Calendar,
  Clock3,
  MapPin,
  Video,
  Filter,
  Check,
  CalendarPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RescheduleAppointmentDialog } from "@/components/shared/reschedule-appointment-dialog";
import { CancelAppointmentDialog } from "@/components/shared/form-dialogs";
import { AddToCalendar } from "@/components/shared/add-to-calendar";
import { toEventStart, type CalendarEvent } from "@/lib/calendar-export";
import { CalendarView } from "./calendar-view";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { usePatientStore, type Appointment } from "@/lib/patient-store";

type StatusFilter = "confirmed" | "requested";
type ModeFilter = "in-person" | "telehealth";

function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s*/, "")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isPast(a: Appointment): boolean {
  return a.status === "completed" || a.status === "cancelled" || a.status === "no-show" || a.status === "rejected";
}

function appointmentToEvent(a: Appointment): CalendarEvent {
  return {
    id: a.id,
    title: `${a.clinician} · ${a.department}`,
    start: toEventStart(a.date, a.time),
    durationMinutes: 15,
    location: a.mode === "telehealth" ? "Telehealth (video link)" : `${a.department} Wing`,
    description: a.reason,
  };
}

function dateLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface DbAppointment {
  id: string;
  clinicianId: string;
  clinicianName: string;
  clinicianDepartment: string;
  startsAt: string;
  date: string;
  time: string;
  durationMinutes: number;
  room: string | null;
  notes: string | null;
  status: string;
  mode: "in-person" | "telehealth";
  proposedStartsAt?: string | null;
  proposedNote?: string | null;
}

function mapDbStatus(s: string): Appointment["status"] {
  if (s === "completed") return "completed";
  if (s === "cancelled") return "cancelled";
  if (s === "no_show") return "no-show";
  if (s === "requested") return "requested";
  if (s === "reschedule_requested") return "reschedule-requested";
  if (s === "arrived") return "arrived";
  if (s === "in_progress") return "in-progress";
  return "confirmed";
}

function dbAppointmentToAppointment(d: DbAppointment): Appointment {
  return {
    id: d.id,
    clinician: d.clinicianName,
    department: d.clinicianDepartment,
    date: d.date,
    time: d.time,
    mode: d.mode,
    status: mapDbStatus(d.status),
    reason: d.notes ?? "Visit",
    documentIds: [],
    createdAt: d.startsAt,
  };
}

// Appointments are DB-authoritative: the page shows ONLY the signed-in
// patient's real rows from /api/patient/appointments. The localStorage demo
// seed is never displayed (it previously leaked in when the API returned an
// empty list, showing fake "demo" appointments to brand-new patients).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isDbId(id: string): boolean { return UUID_RE.test(id); }

interface DbExtras { proposedStartsAt: string | null; proposedNote: string | null; startsAt: string }

export default function AppointmentsPage() {
  const { state, rescheduleAppointment, cancelAppointment, addNotification } = usePatientStore();
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([]);
  const [modeFilters, setModeFilters] = useState<ModeFilter[]>([]);
  const [dbAppointments, setDbAppointments] = useState<Appointment[]>([]);
  const [dbExtras, setDbExtras] = useState<Record<string, DbExtras>>({});
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/patient/appointments", { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        if (!alive || !data?.ok) return;
        const list = data.appointments as DbAppointment[];
        setDbAppointments(list.map(dbAppointmentToAppointment));
        const extras: Record<string, DbExtras> = {};
        for (const a of list) {
          extras[a.id] = {
            proposedStartsAt: a.proposedStartsAt ?? null,
            proposedNote: a.proposedNote ?? null,
            startsAt: a.startsAt,
          };
        }
        setDbExtras(extras);
      } catch (err) {
        console.error("[patient/appointments] fetch", err);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  // DB rows are the only source of truth — never fall back to the demo store.
  const allAppointments = dbAppointments;

  function toggleStatus(s: StatusFilter) {
    setStatusFilters((curr) => (curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]));
  }
  function toggleMode(m: ModeFilter) {
    setModeFilters((curr) => (curr.includes(m) ? curr.filter((x) => x !== m) : [...curr, m]));
  }
  function clearFilters() {
    setStatusFilters([]);
    setModeFilters([]);
  }

  const upcoming = useMemo(
    () =>
      allAppointments
        .filter((a) => !isPast(a))
        .filter((a) => {
          const status = a.status === "confirmed" ? "confirmed" : "requested";
          if (statusFilters.length > 0 && !statusFilters.includes(status as StatusFilter)) return false;
          if (modeFilters.length > 0 && !modeFilters.includes(a.mode)) return false;
          return true;
        })
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [allAppointments, statusFilters, modeFilters],
  );

  const past = useMemo(
    () =>
      allAppointments
        .filter(isPast)
        .filter((a) => {
          if (modeFilters.length > 0 && !modeFilters.includes(a.mode)) return false;
          return true;
        })
        .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    [allAppointments, modeFilters],
  );

  const anyFilter = statusFilters.length > 0 || modeFilters.length > 0;

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  return (
    <>
      <PageHeader
        eyebrow="Appointments"
        title="Schedule & manage your visits"
        description="Booking is consent-bound to assigned clinicians. Cancellations follow your clinic's window policy. Reminders are sent T-24h and T-1h."
        actions={
          <>
            {upcoming.length > 0 && (
              <AddToCalendar
                event={upcoming.map(appointmentToEvent)}
                filename="healthsecure-appointments"
                label="Export (.ics)"
              />
            )}
            <Button asChild>
              <Link href="/patient/appointments/new"><Plus /> Book appointment</Link>
            </Button>
          </>
        }
      />

      <Tabs defaultValue="upcoming">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming · {upcoming.length}</TabsTrigger>
            <TabsTrigger value="past">Past · {past.length}</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter /> Filter{anyFilter ? ` · ${statusFilters.length + modeFilters.length}` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("confirmed"); }}>
                {statusFilters.includes("confirmed") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Confirmed
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("requested"); }}>
                {statusFilters.includes("requested") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Requested
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Mode</DropdownMenuLabel>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleMode("in-person"); }}>
                {modeFilters.includes("in-person") ? <Check className="size-3.5" /> : <span className="size-3.5" />} In-person
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleMode("telehealth"); }}>
                {modeFilters.includes("telehealth") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Telehealth
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={clearFilters}>Clear filters</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <TabsContent value="upcoming">
          {upcoming.length === 0 ? (
            <EmptyState
              title={dbAppointments.length === 0 ? "No appointments yet" : "No upcoming appointments match your filters"}
              hint={dbAppointments.length === 0 ? "Book your first appointment to get started." : undefined}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {upcoming.map((a) => (
                <UpcomingCard
                  key={a.id}
                  apt={a}
                  extras={dbExtras[a.id]}
                  onReschedule={async (newIso) => {
                    if (isDbId(a.id)) {
                      const r = await fetch("/api/patient/appointments", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "patient_reschedule", appointmentId: a.id, proposedStartsAt: newIso }),
                      });
                      const j = await r.json();
                      if (!r.ok || !j?.ok) {
                        toast.error(j?.error ?? "Could not reschedule");
                        return { ok: false };
                      }
                      toast.success("Reschedule sent · clinician will reconfirm", { description: `New slot: ${new Date(newIso).toLocaleString("en-IN", { hour12: false })}` });
                      reload();
                      return { ok: true };
                    }
                    // Local-store fallback for legacy slug ids.
                    const label = new Date(newIso).toLocaleString("en-IN", { hour12: false });
                    rescheduleAppointment(a.id, a.date, label);
                    toast.success("Appointment rescheduled", { description: `New slot: ${label}` });
                    return { ok: true };
                  }}
                  onCancel={async (reason) => {
                    if (isDbId(a.id)) {
                      const r = await fetch("/api/patient/appointments", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "cancel", appointmentId: a.id, reason }),
                      });
                      const j = await r.json();
                      if (!r.ok || !j?.ok) { toast.error(j?.error ?? "Could not cancel"); return; }
                      toast.warning("Appointment cancelled", { description: reason ? `Reason: ${reason} · audit-logged` : "Reminders cancelled · audit-logged" });
                      reload();
                      return;
                    }
                    cancelAppointment(a.id);
                    addNotification({ title: "Appointment cancelled", body: `${a.clinician} · ${dateLabel(a.date)} ${a.time}`, type: "appointment" });
                    toast.warning("Appointment cancelled");
                  }}
                  onAcceptReschedule={async () => {
                    const proposed = dbExtras[a.id]?.proposedStartsAt ?? null;
                    const r = await fetch("/api/patient/appointments", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "accept_reschedule", appointmentId: a.id }),
                    });
                    const j = await r.json();
                    if (!r.ok || !j?.ok) { toast.error(j?.error ?? "Could not accept"); return; }
                    // Optimistic local update so the proposal banner + amber
                    // pill disappear instantly without waiting for the refetch.
                    setDbExtras((curr) => ({
                      ...curr,
                      [a.id]: { proposedStartsAt: null, proposedNote: null, startsAt: proposed ?? curr[a.id]?.startsAt ?? a.createdAt },
                    }));
                    setDbAppointments((curr) =>
                      curr.map((x) => (x.id === a.id ? { ...x, status: "confirmed" as const, date: proposed ? proposed.slice(0, 10) : x.date, time: proposed ? new Date(proposed).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : x.time } : x)),
                    );
                    toast.success("New slot confirmed · reminders scheduled");
                    reload();
                  }}
                  onDeclineReschedule={async () => {
                    const r = await fetch("/api/patient/appointments", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "decline_reschedule", appointmentId: a.id }),
                    });
                    const j = await r.json();
                    if (!r.ok || !j?.ok) { toast.error(j?.error ?? "Could not decline"); return; }
                    // Optimistic — banner disappears + status reverts to requested.
                    setDbExtras((curr) => ({
                      ...curr,
                      [a.id]: { proposedStartsAt: null, proposedNote: null, startsAt: curr[a.id]?.startsAt ?? a.createdAt },
                    }));
                    setDbAppointments((curr) =>
                      curr.map((x) => (x.id === a.id ? { ...x, status: "requested" as const } : x)),
                    );
                    toast.info("Proposal declined · clinician notified");
                    reload();
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past">
          {past.length === 0 ? (
            <EmptyState title="No past appointments yet" />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <ul className="divide-y divide-[var(--color-border)]">
                {past.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 p-5 hover:bg-[var(--color-muted)]/30">
                    <Avatar className="size-10"><AvatarFallback>{initials(p.clinician)}</AvatarFallback></Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{p.clinician}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">{p.reason}</p>
                    </div>
                    <div className="hidden text-right text-xs text-[var(--color-muted-foreground)] sm:block">
                      <p>{dateLabel(p.date)}</p>
                      <p className="font-mono">{p.time}</p>
                    </div>
                    {p.status === "completed" && <Badge variant="success" size="sm" dot>Completed</Badge>}
                    {p.status === "cancelled" && <Badge variant="muted" size="sm" dot>Cancelled</Badge>}
                    {p.status === "rejected" && <Badge variant="danger" size="sm" dot>Declined</Badge>}
                    {p.status === "no-show" && <Badge variant="danger" size="sm" dot>No-show</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarView />
        </TabsContent>
      </Tabs>
    </>
  );
}

function UpcomingCard({
  apt,
  extras,
  onReschedule,
  onCancel,
  onAcceptReschedule,
  onDeclineReschedule,
}: {
  apt: Appointment;
  extras?: { proposedStartsAt: string | null; proposedNote: string | null; startsAt: string };
  onReschedule: (newIso: string) => Promise<{ ok: boolean }>;
  onCancel: (reason: string) => void | Promise<void>;
  onAcceptReschedule: () => void | Promise<void>;
  onDeclineReschedule: () => void | Promise<void>;
}) {
  const Icon = apt.mode === "telehealth" ? Video : MapPin;
  const location =
    apt.mode === "telehealth"
      ? "Telehealth · video link 1h before"
      : `${apt.department} Wing`;
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const hasProposal = apt.status === "reschedule-requested" && extras?.proposedStartsAt;

  return (
    <div className="group overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-primary-50)] to-transparent px-5 py-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-primary-700)]">
          <Calendar className="size-3.5" />
          {dateLabel(apt.date)}
        </div>
        {apt.status === "confirmed" && <Badge variant="info" size="sm" dot>Confirmed</Badge>}
        {apt.status === "requested" && <Badge variant="warning" size="sm" dot>Requested</Badge>}
        {apt.status === "reschedule-requested" && <Badge variant="warning" size="sm" dot>Reschedule proposed</Badge>}
        {apt.status === "arrived" && <Badge variant="warning" size="sm" dot>Arrived</Badge>}
        {apt.status === "in-progress" && <Badge variant="success" size="sm" dot>In progress</Badge>}
        {apt.status === "completed" && <Badge variant="success" size="sm" dot>Completed</Badge>}
        {apt.status === "cancelled" && <Badge variant="muted" size="sm" dot>Cancelled</Badge>}
        {apt.status === "no-show" && <Badge variant="danger" size="sm" dot>No-show</Badge>}
      </div>
      <Link href={`/patient/appointments/${apt.id}`} className="block">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <Avatar className="size-12">
              <AvatarFallback>{initials(apt.clinician)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-base font-semibold">{apt.clinician}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{apt.department}</p>
              <p className="mt-2 text-sm">{apt.reason}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[var(--color-muted-foreground)]">
              <Clock3 className="size-3.5" /> {apt.time}
            </div>
            <div className="flex items-center gap-2 text-[var(--color-muted-foreground)]">
              <Icon className="size-3.5" /> {location}
            </div>
          </div>
        </div>
      </Link>
      {hasProposal && (
        <div className="border-t border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/30 px-5 py-3 text-xs">
          <p className="font-semibold text-[oklch(0.45_0.14_75)] dark:text-[oklch(0.85_0.13_80)]">
            {apt.clinician} proposed a new slot
          </p>
          <p className="mt-0.5 text-[var(--color-muted-foreground)]">
            {new Date(extras!.proposedStartsAt!).toLocaleString("en-IN", { hour12: false })}
            {extras?.proposedNote ? ` · ${extras.proposedNote}` : ""}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={onAcceptReschedule}>Accept new slot</Button>
            <Button size="sm" variant="outline" onClick={onDeclineReschedule}>Decline</Button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-muted)]/30 px-5 py-3">
        <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{apt.id}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRescheduleOpen(true)}
            disabled={apt.status === "arrived" || apt.status === "in-progress"}
          >
            Reschedule
          </Button>
          <RescheduleAppointmentDialog
            open={rescheduleOpen}
            onOpenChange={setRescheduleOpen}
            currentStartsAt={extras?.startsAt ?? new Date().toISOString()}
            currentLabel={`${dateLabel(apt.date)} · ${apt.time}`}
            clinicianName={apt.clinician}
            mode="patient_request"
            onSubmit={async ({ startsAt }) => onReschedule(startsAt)}
          />
          <CancelAppointmentDialog
            triggerProps={{
              variant: "ghost",
              size: "sm",
              className: "text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]",
            }}
            appointment={{
              id: apt.id,
              reason: apt.reason,
              date: dateLabel(apt.date),
              time: apt.time,
              doctor: apt.clinician,
            }}
            onConfirm={onCancel}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
        <CalendarPlus className="size-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {hint && (
        <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">{hint}</p>
      )}
      <Button asChild size="sm" className="mt-1">
        <Link href="/patient/appointments/new"><Plus /> Book appointment</Link>
      </Button>
    </div>
  );
}
