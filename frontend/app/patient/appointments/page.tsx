"use client";

import { useMemo, useState } from "react";
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
import { RescheduleDialog, CancelAppointmentDialog } from "@/components/shared/form-dialogs";
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
  return a.status === "completed" || a.status === "cancelled" || a.status === "no-show";
}

function dateLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AppointmentsPage() {
  const { state, rescheduleAppointment, cancelAppointment, addNotification } = usePatientStore();
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([]);
  const [modeFilters, setModeFilters] = useState<ModeFilter[]>([]);

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
      state.appointments
        .filter((a) => !isPast(a))
        .filter((a) => {
          const status = a.status === "confirmed" ? "confirmed" : "requested";
          if (statusFilters.length > 0 && !statusFilters.includes(status as StatusFilter)) return false;
          if (modeFilters.length > 0 && !modeFilters.includes(a.mode)) return false;
          return true;
        })
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [state.appointments, statusFilters, modeFilters],
  );

  const past = useMemo(
    () =>
      state.appointments
        .filter(isPast)
        .filter((a) => {
          if (modeFilters.length > 0 && !modeFilters.includes(a.mode)) return false;
          return true;
        })
        .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    [state.appointments, modeFilters],
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
          <Button asChild>
            <Link href="/patient/appointments/new"><Plus /> Book appointment</Link>
          </Button>
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
              title={state.appointments.length === 0 ? "No appointments yet" : "No upcoming appointments match your filters"}
              hint={state.appointments.length === 0 ? "Book your first appointment to get started." : undefined}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {upcoming.map((a) => (
                <UpcomingCard
                  key={a.id}
                  apt={a}
                  onReschedule={(slot) => {
                    rescheduleAppointment(a.id, a.date, slot);
                    addNotification({
                      title: "Appointment rescheduled",
                      body: `${a.clinician} · ${slot}`,
                      type: "appointment",
                      href: `/patient/appointments/${a.id}`,
                    });
                    toast.success("Appointment rescheduled", { description: `New slot: ${slot} · reminders updated` });
                  }}
                  onCancel={(reason) => {
                    cancelAppointment(a.id);
                    addNotification({
                      title: "Appointment cancelled",
                      body: `${a.clinician} · ${dateLabel(a.date)} ${a.time}`,
                      type: "appointment",
                    });
                    toast.warning("Appointment cancelled", {
                      description: reason ? `Reason: ${reason} · audit-logged` : "Reminder jobs cancelled · audit-logged",
                    });
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
  onReschedule,
  onCancel,
}: {
  apt: Appointment;
  onReschedule: (slot: string) => void;
  onCancel: (reason: string) => void;
}) {
  const Icon = apt.mode === "telehealth" ? Video : MapPin;
  const location =
    apt.mode === "telehealth"
      ? "Telehealth · video link 1h before"
      : `${apt.department} Wing`;

  return (
    <div className="group overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-primary-50)] to-transparent px-5 py-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-primary-700)]">
          <Calendar className="size-3.5" />
          {dateLabel(apt.date)}
        </div>
        {apt.status === "confirmed" ? (
          <Badge variant="info" size="sm" dot>Confirmed</Badge>
        ) : (
          <Badge variant="warning" size="sm" dot>Requested</Badge>
        )}
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
      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-muted)]/30 px-5 py-3">
        <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{apt.id}</span>
        <div className="flex gap-2">
          <RescheduleDialog
            triggerProps={{ variant: "outline", size: "sm" }}
            appointment={{
              id: apt.id,
              doctor: apt.clinician,
              date: dateLabel(apt.date),
              time: apt.time,
            }}
            onConfirm={onReschedule}
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
