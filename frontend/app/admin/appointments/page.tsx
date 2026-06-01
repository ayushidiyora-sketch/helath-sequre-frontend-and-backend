"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Filter,
  ChevronRight,
  Check,
  Plus,
  Loader2,
  Bell,
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
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
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
    telehealth: number;
  }>({ total: 0, confirmed: 0, noShows: 0, telehealth: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [bookOpen, setBookOpen] = useState(false);
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);

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
          telehealth: data.counts.telehealth,
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
            <ConfigureRemindersDialog />
            <Button size="sm" onClick={() => setBookOpen(true)}>
              <Plus /> Book appointment
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Today total" value={counts.total} />
        <Stat label="Confirmed" value={counts.confirmed} good />
        <Stat label="No-shows so far" value={counts.noShows} warn />
        <Stat label="Telehealth" value={counts.telehealth} />
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
        onCreated={() => refresh(date)}
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
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clinicians: Clinician[];
  patientOptions: PatientOption[];
  date: string;
  onCreated: () => void;
}) {
  const [clinicianId, setClinicianId] = useState("");
  // patientKey === "" means no selection; "__custom" means walk-in / typed manually.
  const [patientKey, setPatientKey] = useState<string>("");
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [time, setTime] = useState("09:30");
  const [duration, setDuration] = useState(30);
  const [room, setRoom] = useState("");
  const [status, setStatus] = useState<Status>("confirmed");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setClinicianId("");
      setPatientKey("");
      setPatientName("");
      setPatientEmail("");
      setTime("09:30");
      setDuration(30);
      setRoom("");
      setStatus("confirmed");
      setError(null);
      setSubmitting(false);
    } else if (clinicians.length > 0 && !clinicianId) {
      setClinicianId(clinicians[0].id);
    }
  }, [open, clinicians, clinicianId]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clinicianId) {
      setError("Select a clinician.");
      return;
    }
    if (status !== "blocked" && !patientName.trim()) {
      setError("Patient name is required (unless blocking a slot).");
      return;
    }
    setSubmitting(true);
    // Combine the date (from page) + time input into an ISO local string.
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
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? "Could not book.");
        setSubmitting(false);
        return;
      }
      toast.success(`${formatTime(data.appointment.startsAt)} booked`, {
        description: `${data.appointment.clinicianName} · ${data.appointment.patientName ?? "Blocked"}`,
      });
      onCreated();
      onOpenChange(false);
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfigureRemindersDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Calendar /> Reminders
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Reminder windows</DialogTitle>
          <DialogDescription>
            When automated appointment reminders are sent to patients.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            toast.success("Reminder settings saved");
          }}
        >
          {[
            { label: "T-24h reminder", desc: "One day before the appointment", on: true },
            { label: "T-1h reminder", desc: "One hour before the appointment", on: true },
            { label: "No-show follow-up", desc: "Sent if the patient misses the slot", on: false },
          ].map((r) => (
            <label
              key={r.label}
              className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3.5"
            >
              <span>
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block text-[11px] text-[var(--color-muted-foreground)]">
                  {r.desc}
                </span>
              </span>
              <Switch defaultChecked={r.on} />
            </label>
          ))}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">
              <Bell /> Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
