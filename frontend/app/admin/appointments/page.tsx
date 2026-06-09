"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Filter,
  ChevronRight,
  Check,
  Plus,
  Loader2,
  Settings as SettingsIcon,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { DAY_KEYS, SCHEDULE_DEFAULTS, type DayKey, type ScheduleShape } from "@/lib/schedule-config";
interface PatientOption {
  key: string; // patient User.id
  name: string;
  email: string;
}

type Status = "confirmed" | "no_show" | "blocked" | "cancelled" | "completed";

interface Appointment {
  id: string;
  clinicianId: string;
  clinicianName: string;
  patientName: string | null;
  patientEmail: string | null;
  startsAt: string;
  durationMinutes: number;
  room: string | null;
  status: Status;
  notes: string | null;
}

interface Clinician {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const STATUS_FILTERS: { key: Status | "all"; label: string }[] = [
  { key: "all", label: "All appointments" },
  { key: "confirmed", label: "Confirmed" },
  { key: "no_show", label: "No-show" },
  { key: "blocked", label: "Blocked" },
  { key: "cancelled", label: "Cancelled" },
];

const SELECT_CLASS =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function todayDateInput(): string {
  // YYYY-MM-DD in the browser's local timezone for an <input type="date">.
  const d = new Date();
  const tzOffset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tzOffset * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function AdminAppointmentsPage() {
  const [date, setDate] = useState<string>(todayDateInput());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [counts, setCounts] = useState<{
    total: number;
    confirmed: number;
    noShows: number;
  }>({ total: 0, confirmed: 0, noShows: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [bookOpen, setBookOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  // Schedule configuration (working hours / slot defaults / policies / reminders).
  // Loaded once and refreshed after the settings dialog saves so the Book
  // dialog's default-duration input reflects new tenant config without a reload.
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleShape>(SCHEDULE_DEFAULTS);

  const loadScheduleConfig = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/schedule-config", { cache: "no-store" });
      const j = (await r.json()) as { ok?: boolean; schedule?: ScheduleShape };
      if (r.ok && j.ok && j.schedule) setScheduleConfig(j.schedule);
    } catch {
      // Network blip — keep defaults.
    }
  }, []);

  useEffect(() => {
    void loadScheduleConfig();
  }, [loadScheduleConfig]);

  const refresh = useCallback(
    async (d: string) => {
      try {
        const r = await fetch(`/api/admin/appointments?date=${encodeURIComponent(d)}`, { cache: "no-store" });
        const data = await r.json();
        if (!r.ok || !data.ok) {
          setError(data.error ?? `HTTP ${r.status}`);
          return;
        }
        setAppointments(data.appointments);
        setCounts({
          total: data.counts.total,
          confirmed: data.counts.confirmed,
          noShows: data.counts.noShows,
        });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load appointments");
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh(date).finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, refresh]);

  // Load tenant clinicians + patients once for the booking dialog dropdowns.
  // Both come straight from Postgres so the dropdown reflects whoever has
  // been invited into this tenant.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/users").then((r) => (r.ok ? r.json() : { staff: [] })),
      fetch("/api/admin/patients").then((r) => (r.ok ? r.json() : { patients: [] })),
    ])
      .then(
        ([staffData, patientData]: [
          { staff?: Clinician[] },
          { patients?: { id: string; name: string; email: string }[] },
        ]) => {
          if (cancelled) return;
          setClinicians((staffData.staff ?? []).filter((s) => s.role === "Clinician"));
          setPatientOptions(
            (patientData.patients ?? []).map((p) => ({
              key: p.id,
              name: p.name,
              email: p.email,
            })),
          );
        },
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (statusFilter === "all" ? appointments : appointments.filter((a) => a.status === statusFilter)),
    [appointments, statusFilter],
  );


  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Clinic-wide schedule"
        description="View, book, and reassign appointments. Each row is a real Postgres appointments record."
        actions={
          <>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[160px]"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={statusFilter !== "all" ? "soft" : "outline"} size="sm">
                  <Filter /> Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_FILTERS.map((s) => (
                  <DropdownMenuItem key={s.key} onSelect={() => setStatusFilter(s.key)}>
                    <Check className={statusFilter === s.key ? "" : "opacity-0"} />
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon /> Schedule settings
            </Button>
            <Button size="sm" onClick={() => setBookOpen(true)}>
              <Plus /> Book appointment
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Today total" value={counts.total} />
        <Stat label="Confirmed" value={counts.confirmed} good />
        <Stat label="No-shows so far" value={counts.noShows} warn />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="grid grid-cols-12 gap-4 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <div className="col-span-2">Time</div>
          <div className="col-span-3">Clinician</div>
          <div className="col-span-3">Patient</div>
          <div className="col-span-2">Room</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 className="size-4 animate-spin" /> Loading schedule…
          </div>
        ) : error ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-danger)]">
            Failed to load — {error}
          </p>
        ) : visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
            {appointments.length === 0
              ? "No appointments scheduled for this day. Click “Book appointment” to add one."
              : "No appointments match the current filter."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {visible.map((a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                clinicians={clinicians}
                onChanged={() => refresh(date)}
              />
            ))}
          </ul>
        )}
      </div>

      <BookAppointmentDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        clinicians={clinicians}
        patientOptions={patientOptions}
        date={date}
        defaultDuration={scheduleConfig.defaultSlotMinutes}
        onCreated={() => refresh(date)}
      />

      <ScheduleSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initial={scheduleConfig}
        onSaved={(next) => {
          setScheduleConfig(next);
        }}
      />
    </>
  );
}

function Stat({
  label,
  value,
  good,
  warn,
}: {
  label: string;
  value: number;
  good?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          good ? "text-[var(--color-success)]" : warn ? "text-[var(--color-warning)]" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function AppointmentRow({
  appointment,
  clinicians,
  onChanged,
}: {
  appointment: Appointment;
  clinicians: Clinician[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(appointment.status);
  const [clinicianId, setClinicianId] = useState(appointment.clinicianId);
  const [room, setRoom] = useState(appointment.room ?? "");
  const [notes, setNotes] = useState(appointment.notes ?? "");

  async function save() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          clinicianId,
          room: room || null,
          notes: notes || null,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        toast.error("Could not save", { description: data.error ?? `HTTP ${r.status}` });
        return;
      }
      toast.success("Appointment updated");
      setOpen(false);
      onChanged();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid w-full grid-cols-12 items-center gap-4 px-5 py-3.5 text-left hover:bg-[var(--color-muted)]/40"
      >
        <div className="col-span-2 font-mono text-sm">{formatTime(appointment.startsAt)}</div>
        <div className="col-span-3 text-sm">{appointment.clinicianName}</div>
        <div className="col-span-3 text-sm">{appointment.patientName ?? "—"}</div>
        <div className="col-span-2 text-xs text-[var(--color-muted-foreground)]">
          {appointment.room ?? "—"}
        </div>
        <div className="col-span-2 flex items-center justify-end gap-1">
          <StatusBadge status={appointment.status} />
          <ChevronRight className="size-4 text-[var(--color-muted-foreground)]" />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {formatTime(appointment.startsAt)} · {appointment.patientName ?? "Blocked"}
            </DialogTitle>
            <DialogDescription>Reassign, change status, or update the room.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="apt-clinician">Clinician</Label>
              <select
                id="apt-clinician"
                className={SELECT_CLASS}
                value={clinicianId}
                onChange={(e) => setClinicianId(e.target.value)}
              >
                {clinicians.map((c) => (
                  <option key={c.id} value={c.id}>
                    Dr. {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="apt-status">Status</Label>
                <select
                  id="apt-status"
                  className={SELECT_CLASS}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="no_show">No-show</option>
                  <option value="blocked">Blocked</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apt-room">Room</Label>
                <Input
                  id="apt-room"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g. 304 or Telehealth"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apt-notes">Notes</Label>
              <Input
                id="apt-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={busy}>
                Close
              </Button>
            </DialogClose>
            <Button onClick={save} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="animate-spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "confirmed")
    return (
      <Badge variant="info" size="sm" dot>
        Confirmed
      </Badge>
    );
  if (status === "no_show")
    return (
      <Badge variant="danger" size="sm" dot>
        No-show
      </Badge>
    );
  if (status === "blocked")
    return (
      <Badge variant="warning" size="sm" dot>
        Blocked
      </Badge>
    );
  if (status === "cancelled") return <Badge variant="muted" size="sm">Cancelled</Badge>;
  return (
    <Badge variant="success" size="sm" dot>
      Completed
    </Badge>
  );
}

function BookAppointmentDialog({
  open,
  onOpenChange,
  clinicians,
  patientOptions,
  date,
  defaultDuration,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clinicians: Clinician[];
  patientOptions: PatientOption[];
  date: string;
  defaultDuration: number;
  onCreated: () => void;
}) {
  const [clinicianId, setClinicianId] = useState("");
  // patientKey === "" means no selection; "__custom" means walk-in / typed manually.
  const [patientKey, setPatientKey] = useState<string>("");
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [time, setTime] = useState("09:30");
  const [duration, setDuration] = useState(defaultDuration);
  const [room, setRoom] = useState("");
  const [status, setStatus] = useState<Status>("confirmed");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the server returns a 409 — surfaces conflict context and gates an
  // "Override and book anyway" button (per 3.5 "Override scheduling conflicts").
  const [conflict, setConflict] = useState<
    | null
    | {
        reason: string;
        detail?: string;
      }
  >(null);

  useEffect(() => {
    if (!open) {
      setClinicianId("");
      setPatientKey("");
      setPatientName("");
      setPatientEmail("");
      setTime("09:30");
      setDuration(defaultDuration);
      setRoom("");
      setStatus("confirmed");
      setError(null);
      setConflict(null);
      setSubmitting(false);
    } else if (clinicians.length > 0 && !clinicianId) {
      setClinicianId(clinicians[0].id);
    }
  }, [open, clinicians, clinicianId, defaultDuration]);

  // When a real patient is picked, auto-fill name + email; for "walk-in" leave
  // the fields editable; for empty selection clear them.
  function selectPatient(key: string) {
    setPatientKey(key);
    if (key === "" || key === "__custom") {
      if (key === "") {
        setPatientName("");
        setPatientEmail("");
      }
      return;
    }
    const p = patientOptions.find((x) => x.key === key);
    if (p) {
      setPatientName(p.name);
      setPatientEmail(p.email);
    }
  }

  /**
   * Book. `override=true` is passed only on the second attempt, after the
   * server returned 409 and the user clicked "Override and book anyway".
   */
  async function postBooking(override: boolean) {
    if (!clinicianId) {
      setError("Select a clinician.");
      return;
    }
    if (status !== "blocked" && !patientName.trim()) {
      setError("Patient name is required (unless blocking a slot).");
      return;
    }
    setSubmitting(true);
    setError(null);
    const startsAt = new Date(`${date}T${time}:00`).toISOString();
    try {
      const r = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicianId,
          patientName: patientName.trim() || null,
          patientEmail: patientEmail.trim() || null,
          startsAt,
          durationMinutes: duration,
          room: room.trim() || null,
          status,
          override,
        }),
      });
      const data = await r.json();
      if (r.status === 409 && data.conflict) {
        // Surface the conflict in the dialog body. The submit button changes
        // to "Override and book anyway" on this state.
        const c = data.conflict as {
          kind: "working_hours" | "overlap";
          reason?: string;
          patientName?: string | null;
          startsAt?: string;
          durationMinutes?: number;
        };
        setConflict({
          reason: c.kind === "working_hours" ? (c.reason ?? "Outside working hours.") : "Slot overlaps an existing appointment.",
          detail:
            c.kind === "overlap" && c.startsAt
              ? `Existing: ${formatTime(c.startsAt)} · ${c.durationMinutes}min · ${c.patientName ?? "Blocked"}`
              : undefined,
        });
        setSubmitting(false);
        return;
      }
      if (!r.ok || !data.ok) {
        setError(data.error ?? "Could not book.");
        setSubmitting(false);
        return;
      }
      toast.success(`${formatTime(data.appointment.startsAt)} booked${override ? " (override)" : ""}`, {
        description: `${data.appointment.clinicianName} · ${data.appointment.patientName ?? "Blocked"}`,
      });
      onCreated();
      onOpenChange(false);
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Any edit after a conflict clears the override warning so the user goes
    // through a fresh validation cycle.
    if (conflict) setConflict(null);
    void postBooking(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Book appointment</DialogTitle>
          <DialogDescription>
            Date: <span className="font-medium">{date}</span>. The appointment is saved to Postgres
            and appears on the schedule immediately.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4 pt-2" onSubmit={submit}>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
            >
              {error}
            </div>
          )}
          {conflict && (
            <div
              role="alert"
              className="rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)]/40 px-3.5 py-2.5 text-sm"
            >
              <p className="flex items-start gap-1.5 font-medium text-[var(--color-warning)]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {conflict.reason}
              </p>
              {conflict.detail && (
                <p className="mt-0.5 pl-5 text-[12px] text-[var(--color-muted-foreground)]">
                  {conflict.detail}
                </p>
              )}
              <p className="mt-1.5 pl-5 text-[11px] text-[var(--color-muted-foreground)]">
                As Org Admin you can override and book the slot anyway.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="book-clinician">Clinician</Label>
            <select
              id="book-clinician"
              className={SELECT_CLASS}
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              required
            >
              {clinicians.length === 0 && <option value="">No clinicians in this tenant</option>}
              {clinicians.map((c) => (
                <option key={c.id} value={c.id}>
                  Dr. {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="book-patient-select">Patient</Label>
              <select
                id="book-patient-select"
                className={SELECT_CLASS}
                value={patientKey}
                onChange={(e) => selectPatient(e.target.value)}
                disabled={status === "blocked"}
              >
                <option value="">— Select patient —</option>
                {patientOptions.length === 0 && (
                  <option value="" disabled>
                    No patients in this tenant yet
                  </option>
                )}
                {patientOptions.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
                <option value="__custom">Other / walk-in (type below)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-email">Patient email</Label>
              <Input
                id="book-email"
                type="email"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                placeholder={
                  patientKey && patientKey !== "__custom"
                    ? "Auto-filled from selection"
                    : "patient@example.com"
                }
                // Auto-filled and locked when a real patient is chosen; editable
                // for walk-ins or when no selection has been made.
                readOnly={patientKey !== "" && patientKey !== "__custom"}
                disabled={status === "blocked"}
                className={patientKey !== "" && patientKey !== "__custom" ? "bg-[var(--color-muted)]" : undefined}
              />
            </div>
          </div>
          {patientKey === "__custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="book-patient-name">Walk-in patient name</Label>
              <Input
                id="book-patient-name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Aarav Mehta"
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="book-time">Time</Label>
              <Input
                id="book-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-duration">Duration</Label>
              <select
                id="book-duration"
                className={SELECT_CLASS}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={15}>15 min</option>
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-status">Status</Label>
              <select
                id="book-status"
                className={SELECT_CLASS}
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                <option value="confirmed">Confirmed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="book-room">Room</Label>
            <Input
              id="book-room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. 304 or Telehealth"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            {conflict ? (
              <Button
                type="button"
                variant="destructive"
                disabled={submitting}
                onClick={() => void postBooking(true)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" /> Booking…
                  </>
                ) : (
                  <>
                    <AlertTriangle /> Override and book anyway
                  </>
                )}
              </Button>
            ) : (
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" /> Booking…
                  </>
                ) : (
                  <>
                    <Plus /> Book appointment
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Schedule settings — covers the four configurable bits in section 3.5:
 *   1. Working hours (per day × open/close + enabled toggle)
 *   2. Default slot duration (sets the Book dialog's initial value)
 *   3. Reschedule / cancellation windows (min hours before slot)
 *   4. Reminder timing (T-24h, T-1h, no-show follow-up)
 *
 * All values are persisted to `organizations.settings.schedule` via
 * PATCH /api/admin/schedule-config. The form mirrors the saved state on
 * load + after a successful save; Discard reverts to last-saved.
 */
function ScheduleSettingsDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ScheduleShape;
  onSaved: (next: ScheduleShape) => void;
}) {
  const [config, setConfig] = useState<ScheduleShape>(initial);
  const [saved, setSavedSnapshot] = useState<ScheduleShape>(initial);
  const [saving, setSaving] = useState(false);

  // Reset to the latest server-known state every time the dialog opens.
  useEffect(() => {
    if (open) {
      setConfig(initial);
      setSavedSnapshot(initial);
    }
  }, [open, initial]);

  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/schedule-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const j = (await r.json()) as { ok: boolean; error?: string; schedule?: ScheduleShape };
      if (!r.ok || !j.ok || !j.schedule) {
        toast.error("Could not save schedule settings", {
          description: j.error ?? `HTTP ${r.status}`,
        });
        return;
      }
      setConfig(j.schedule);
      setSavedSnapshot(j.schedule);
      onSaved(j.schedule);
      toast.success("Schedule settings saved", {
        description: "Audit-logged · applies to future bookings.",
      });
    } catch (e) {
      toast.error("Could not save", {
        description: e instanceof Error ? e.message : "Network error",
      });
    } finally {
      setSaving(false);
    }
  }

  const updateDay = (day: DayKey, patch: Partial<ScheduleShape["workingHours"][DayKey]>) =>
    setConfig((c) => ({
      ...c,
      workingHours: { ...c.workingHours, [day]: { ...c.workingHours[day], ...patch } },
    }));

  const DAY_LABEL: Record<DayKey, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Schedule settings</DialogTitle>
          <DialogDescription>
            Working hours, default slot length, reschedule / cancellation policies, and
            reminder timing. Applied to all clinic-wide bookings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* 1. Working hours */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Organization working hours</h4>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              Bookings outside these windows are rejected unless the admin explicitly overrides.
            </p>
            <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {DAY_KEYS.map((day) => {
                const h = config.workingHours[day];
                return (
                  <div key={day} className="grid grid-cols-12 items-center gap-3 px-3.5 py-2.5">
                    <div className="col-span-2 text-sm font-medium">{DAY_LABEL[day]}</div>
                    <div className="col-span-2">
                      <Switch
                        checked={h.enabled}
                        onCheckedChange={(v) => updateDay(day, { enabled: v })}
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        type="time"
                        value={h.open}
                        onChange={(e) => updateDay(day, { open: e.target.value })}
                        disabled={!h.enabled}
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        type="time"
                        value={h.close}
                        onChange={(e) => updateDay(day, { close: e.target.value })}
                        disabled={!h.enabled}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Slot defaults */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Default slot template</h4>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              The Book dialog uses this as the initial duration.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-default-duration">Default duration (minutes)</Label>
                <select
                  id="cfg-default-duration"
                  className={SELECT_CLASS}
                  value={config.defaultSlotMinutes}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, defaultSlotMinutes: Number(e.target.value) }))
                  }
                >
                  {[15, 20, 30, 45, 60, 90].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* 3. Reschedule / cancellation windows */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Reschedule &amp; cancellation windows</h4>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              Minimum advance notice (in hours) required before patients can reschedule or cancel a slot.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-reschedule">Reschedule (hours before)</Label>
                <Input
                  id="cfg-reschedule"
                  type="number"
                  min={0}
                  max={168}
                  value={config.reschedulePolicy.minHoursBefore}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      reschedulePolicy: { minHoursBefore: parseInt(e.target.value, 10) || 0 },
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cfg-cancel">Cancel (hours before)</Label>
                <Input
                  id="cfg-cancel"
                  type="number"
                  min={0}
                  max={168}
                  value={config.cancellationPolicy.minHoursBefore}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      cancellationPolicy: { minHoursBefore: parseInt(e.target.value, 10) || 0 },
                    }))
                  }
                />
              </div>
            </div>
          </section>

          {/* 4. Reminders */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Reminder timing</h4>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              Automated reminders sent to patients before / after their appointment.
            </p>
            {[
              { key: "t24h" as const, label: "T-24h reminder", desc: "One day before the appointment" },
              { key: "t1h" as const, label: "T-1h reminder", desc: "One hour before the appointment" },
              {
                key: "noShowFollowup" as const,
                label: "No-show follow-up",
                desc: "Sent if the patient misses the slot",
              },
            ].map((r) => (
              <label
                key={r.key}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-3.5 py-2.5"
              >
                <span>
                  <span className="block text-sm font-medium">{r.label}</span>
                  <span className="block text-[11px] text-[var(--color-muted-foreground)]">
                    {r.desc}
                  </span>
                </span>
                <Switch
                  checked={config.reminders[r.key]}
                  onCheckedChange={(v) =>
                    setConfig((c) => ({ ...c, reminders: { ...c.reminders, [r.key]: v } }))
                  }
                />
              </label>
            ))}
          </section>
        </div>

        <DialogFooter className="mt-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={saving}>
              Close
            </Button>
          </DialogClose>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
