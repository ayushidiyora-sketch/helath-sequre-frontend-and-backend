"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Ban,
  Video,
  MapPin,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useClinicianStore,
  type Weekday,
  type DayTemplate,
  type ClinicianAppointment,
  type BlockedSlot,
} from "@/lib/clinician-store";

const WEEKDAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatHeader(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function shiftDate(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function fmtTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function ClinicianSchedulePage() {
  const { state, addBlockedSlot, removeBlockedSlot, updateDayTemplate } = useClinicianStore();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [view, setView] = useState<"day" | "week" | "availability">("day");
  const [blockOpen, setBlockOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editDay, setEditDay] = useState<Weekday | null>(null);

  const today = useMemo(() => new Date(), []);
  const isToday = isSameDay(selectedDate, today);
  const stride = view === "week" ? 7 : 1;

  const selectedDateIso = selectedDate.toISOString().slice(0, 10);
  const dayAppointments = useMemo(
    () => state.appointments.filter((a) => a.date === selectedDateIso).sort((a, b) => a.time.localeCompare(b.time)),
    [state.appointments, selectedDateIso],
  );
  const dayBlocks = useMemo(
    () => state.blockedSlots.filter((b) => b.date === selectedDateIso),
    [state.blockedSlots, selectedDateIso],
  );
  const totalSlots = dayAppointments.length + dayBlocks.length;
  const completedSlots = dayAppointments.filter((a) => a.status === "completed").length;
const slots = [
  { time: "9:00 AM", patient: "Rohan Jain · ECG review", status: "completed", mode: "office" as const },
  { time: "9:15 AM", patient: "Saanvi Sen · Initial consult", status: "completed", mode: "telehealth" as const },
  { time: "9:30 AM", patient: "Aarav Mehta · Cardiology follow-up", status: "next", mode: "office" as const },
  { time: "9:45 AM", patient: "Neha Bansal · Hypertension", status: "upcoming", mode: "office" as const },
  { time: "10:00 AM", patient: "— blocked —", status: "blocked" as const, mode: "office" as const },
  { time: "10:15 AM", patient: "Vikram Rao · Lipid recheck", status: "upcoming", mode: "office" as const },
  { time: "10:30 AM", patient: "— available —", status: "available" as const, mode: "office" as const },
  { time: "10:45 AM", patient: "— available —", status: "available" as const, mode: "office" as const },
  { time: "11:00 AM", patient: "Ananya Joshi · Telehealth", status: "upcoming", mode: "telehealth" as const },
];

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title={`${isToday ? "Today · " : ""}${formatHeader(selectedDate)}`}
        description={`${completedSlots} of ${totalSlots || "0"} slots booked. Reassignments require Org Admin approval.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setBlockOpen(true)}>
              <Ban /> Block slot
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Add availability
            </Button>
          </>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="availability">Availability templates</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setSelectedDate((d) => shiftDate(d, -stride))}
              aria-label={view === "week" ? "Previous week" : "Previous day"}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(today)}
              disabled={isToday}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setSelectedDate((d) => shiftDate(d, stride))}
              aria-label={view === "week" ? "Next week" : "Next day"}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        <TabsContent value="day">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            {/* Header row — md+ only. */}
            <div className="hidden md:grid grid-cols-12 gap-4 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <div className="col-span-2">Time</div>
              <div className="col-span-7">Patient · Reason</div>
              <div className="col-span-1 text-center">Mode</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <ul className="divide-y divide-[var(--color-border)]">
              {slots.map((s, i) => {
                const ModeIcon = s.mode === "office" ? MapPin : Video;
                return (
                  <li
                    key={i}
                    className={`flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-[var(--color-muted)]/30 sm:px-5 md:grid md:grid-cols-12 md:items-center md:gap-4 ${s.status === "next" ? "bg-[var(--color-primary-50)]/30" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3 md:contents">
                      <div className="font-mono text-sm md:col-span-2">{s.time}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)] md:hidden">
                        <ModeIcon className="size-3.5" />
                        <span>{s.mode === "office" ? "In-person" : "Telehealth"}</span>
                      </div>
                    </div>
                    <div className="text-sm md:col-span-7">
                      {s.status === "blocked" ? (
                        <span className="italic text-[var(--color-muted-foreground)]">Blocked · personal time</span>
                      ) : s.status === "available" ? (
                        <span className="text-[var(--color-muted-foreground)]">Open slot</span>
                      ) : (
                        s.patient
                      )}
                    </div>
                    <div className="hidden md:col-span-1 md:flex justify-center text-[var(--color-muted-foreground)]">
                      <ModeIcon className="size-4" />
                    </div>
                    <div className="flex justify-start md:col-span-2 md:justify-end">
                      {s.status === "completed" && <Badge variant="success" size="sm" dot>Completed</Badge>}
                      {s.status === "next" && <Badge variant="info" size="sm" dot>Next</Badge>}
                      {s.status === "upcoming" && <Badge variant="muted" size="sm">Upcoming</Badge>}
                      {s.status === "blocked" && <Badge variant="warning" size="sm" dot>Blocked</Badge>}
                      {s.status === "available" && <Badge variant="outline" size="sm">Available</Badge>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="week">
          <WeekView
            anchor={selectedDate}
            appointments={state.appointments}
            blockedSlots={state.blockedSlots}
            onPickDay={(d) => {
              setSelectedDate(d);
              setView("day");
            }}
          />
        </TabsContent>

        <TabsContent value="availability">
          <div className="space-y-3">
            {WEEKDAYS.map((d) => {
              const t = state.scheduleTemplate[d];
              return (
                <div
                  key={d}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="text-sm font-semibold sm:w-28 sm:shrink-0">{d}</div>
                  <div className="flex flex-1 flex-wrap items-center gap-2 text-xs">
                    {t.off ? (
                      <Badge variant="muted" size="sm">Off</Badge>
                    ) : (
                      <>
                        {t.morning && (
                          <Badge variant="default" size="sm" className="whitespace-nowrap">
                            <Clock3 /> {fmtTime12(t.morning.start)} – {fmtTime12(t.morning.end)}
                          </Badge>
                        )}
                        {t.afternoon && (
                          <Badge variant="default" size="sm" className="whitespace-nowrap">
                            <Clock3 /> {fmtTime12(t.afternoon.start)} – {fmtTime12(t.afternoon.end)}
                          </Badge>
                        )}
                        {!t.morning && !t.afternoon && (
                          <span className="text-[11px] italic text-[var(--color-muted-foreground)]">No blocks set</span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <Badge variant="muted" size="sm" className="whitespace-nowrap">{t.slotMinutes}-min slots</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setEditDay(d)}>
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <BlockSlotDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        dateIso={selectedDateIso}
        dateLabel={formatHeader(selectedDate)}
        onSave={(start, end, reason) => {
          addBlockedSlot({ date: selectedDateIso, start, end, reason });
          toast.warning("Slot blocked", { description: `${formatHeader(selectedDate)} · ${fmtTime12(start)}–${fmtTime12(end)}` });
        }}
      />
      <AddAvailabilityDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={(days, start, end, slot) => {
          for (const d of days) {
            updateDayTemplate(d, {
              morning: { start, end },
              afternoon: undefined,
              slotMinutes: parseInt(slot, 10),
              off: false,
            });
          }
          toast.success("Availability saved", { description: `${days.join(", ")} · ${fmtTime12(start)}–${fmtTime12(end)} · ${slot}-min slots` });
        }}
      />
      <EditTemplateDialog
        day={editDay}
        template={editDay ? state.scheduleTemplate[editDay] : null}
        onClose={() => setEditDay(null)}
        onSave={(day, next) => {
          updateDayTemplate(day, next);
          toast.success(`${day} availability updated`);
          setEditDay(null);
        }}
      />
    </>
  );
}

// --------------------------------------------------------------------------
// Week view
// --------------------------------------------------------------------------

function WeekView({
  anchor,
  appointments,
  blockedSlots,
  onPickDay,
}: {
  anchor: Date;
  appointments: ClinicianAppointment[];
  blockedSlots: BlockedSlot[];
  onPickDay: (d: Date) => void;
}) {
  // Build the 7 days of the week containing `anchor`. Monday-first.
  const days = useMemo(() => {
    const a = new Date(anchor);
    const dow = a.getDay(); // 0=Sun..6=Sat
    const offsetToMonday = (dow + 6) % 7; // turn Sun=0 into 6, Mon=1 into 0, etc.
    const start = new Date(a);
    start.setDate(a.getDate() - offsetToMonday);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [anchor]);

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((d) => {
        const iso = d.toISOString().slice(0, 10);
        const dayAppts = appointments
          .filter((a) => a.date === iso)
          .sort((a, b) => a.time.localeCompare(b.time));
        const dayBlocks = blockedSlots.filter((b) => b.date === iso);
        const isToday = iso === todayIso;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onPickDay(d)}
            className={`group relative flex h-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${
              isToday
                ? "border-[var(--color-primary)]/40 bg-[var(--color-primary-50)]/40"
                : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-muted)]/40"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p className={`text-lg font-semibold ${isToday ? "text-[var(--color-primary-700)]" : ""}`}>
                  {d.getDate()}
                </p>
              </div>
              {dayAppts.length > 0 && (
                <Badge variant={isToday ? "info" : "muted"} size="sm">
                  {dayAppts.length} appt{dayAppts.length === 1 ? "" : "s"}
                </Badge>
              )}
            </div>

            <ul className="flex-1 space-y-1.5 text-[11px]">
              {dayAppts.length === 0 && dayBlocks.length === 0 && (
                <li className="italic text-[var(--color-muted-foreground)]">No bookings</li>
              )}
              {dayAppts.slice(0, 3).map((a) => (
                <li key={a.id} className="flex items-center gap-1.5 truncate">
                  <span className="font-mono text-[var(--color-muted-foreground)]">{a.time}</span>
                  <span className="truncate">{a.reason}</span>
                </li>
              ))}
              {dayAppts.length > 3 && (
                <li className="text-[10px] text-[var(--color-muted-foreground)]">
                  +{dayAppts.length - 3} more
                </li>
              )}
              {dayBlocks.map((b) => (
                <li key={b.id} className="flex items-center gap-1.5 truncate italic text-[var(--color-muted-foreground)]">
                  <Ban className="size-3" />
                  <span className="truncate">{b.reason || "Blocked"}</span>
                </li>
              ))}
            </ul>

            <span className="text-[10px] text-[var(--color-muted-foreground)] group-hover:text-[var(--color-primary-700)]">
              Open day →
            </span>
          </button>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// Block slot
// --------------------------------------------------------------------------

function BlockSlotDialog({
  open,
  onOpenChange,
  dateLabel,
  dateIso,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateLabel: string;
  dateIso: string;
  onSave: (start: string, end: string, reason: string) => void;
}) {
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("13:00");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = start < end && !submitting;

  async function submit() {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 200));
    onSave(start, end, reason);
    setReason("");
    setSubmitting(false);
    onOpenChange(false);
  }
  // Reference dateIso so future server-side validators have access to it.
  void dateIso;
  void dateLabel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block a slot</DialogTitle>
          <DialogDescription>
            Patients won&apos;t see blocked slots. Used for personal time, breaks,
            or focus blocks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="block-start">Start</Label>
              <Input id="block-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-end">End</Label>
              <Input id="block-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {start >= end && (
            <p className="text-[11px] text-[var(--color-danger)]">End must be after start.</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="block-reason">Reason (optional)</Label>
            <Input
              id="block-reason"
              placeholder="e.g. lunch, admin time, focus"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" /> Blocking…
              </>
            ) : (
              "Block slot"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Add availability
// --------------------------------------------------------------------------

function AddAvailabilityDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (days: Weekday[], start: string, end: string, slot: string) => void;
}) {
  const [days, setDays] = useState<Weekday[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [slot, setSlot] = useState("15");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = days.length > 0 && start < end && !submitting;

  function toggleDay(d: Weekday) {
    setDays((curr) => (curr.includes(d) ? curr.filter((x) => x !== d) : [...curr, d]));
  }

  async function submit() {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 200));
    onSave(days, start, end, slot);
    setSubmitting(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add availability</DialogTitle>
          <DialogDescription>
            Create a recurring availability block. Patients booking online can
            pick any open slot in this window.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Days</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    days.includes(d)
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                      : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]/40"
                  }`}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="avl-start">Start</Label>
              <Input id="avl-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avl-end">End</Label>
              <Input id="avl-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="avl-slot">Slot length</Label>
            <select
              id="avl-slot"
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
            >
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" /> Saving…
              </>
            ) : (
              "Save template"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Edit per-day template
// --------------------------------------------------------------------------

function EditTemplateDialog({
  day,
  template,
  onClose,
  onSave,
}: {
  day: Weekday | null;
  template: DayTemplate | null;
  onClose: () => void;
  onSave: (day: Weekday, next: DayTemplate) => void;
}) {
  const open = day !== null && template !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {day ?? ""} availability</DialogTitle>
          <DialogDescription>
            Adjust morning and afternoon blocks for {day ?? "this day"}. Changes
            apply to the recurring template.
          </DialogDescription>
        </DialogHeader>
        {day && template && (
          <EditTemplateForm
            key={day}
            day={day}
            template={template}
            onCancel={onClose}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditTemplateForm({
  day,
  template,
  onCancel,
  onSave,
}: {
  day: Weekday;
  template: DayTemplate;
  onCancel: () => void;
  onSave: (day: Weekday, next: DayTemplate) => void;
}) {
  const [off, setOff] = useState(template.off);
  const [morningStart, setMorningStart] = useState(template.morning?.start ?? "09:00");
  const [morningEnd, setMorningEnd] = useState(template.morning?.end ?? "13:00");
  const [afternoonStart, setAfternoonStart] = useState(template.afternoon?.start ?? "14:00");
  const [afternoonEnd, setAfternoonEnd] = useState(template.afternoon?.end ?? "17:00");
  const [slot, setSlot] = useState(String(template.slotMinutes));
  const [notes, setNotes] = useState("");

  const valid =
    off ||
    (morningStart < morningEnd &&
      afternoonStart < afternoonEnd &&
      morningEnd <= afternoonStart);

  function save() {
    if (!valid) return;
    onSave(day, {
      morning: off ? undefined : { start: morningStart, end: morningEnd },
      afternoon: off ? undefined : { start: afternoonStart, end: afternoonEnd },
      slotMinutes: parseInt(slot, 10),
      off,
    });
    void notes;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={off}
              onChange={(e) => setOff(e.target.checked)}
              className="size-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
            />
            <span>Mark this day as off</span>
          </label>
        </div>
        <div className="space-y-1.5" style={{ display: off ? "none" : undefined }}>
          <Label>Morning block</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input type="time" value={morningStart} onChange={(e) => setMorningStart(e.target.value)} />
            <Input type="time" value={morningEnd} onChange={(e) => setMorningEnd(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5" style={{ display: off ? "none" : undefined }}>
          <Label>Afternoon block</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input type="time" value={afternoonStart} onChange={(e) => setAfternoonStart(e.target.value)} />
            <Input type="time" value={afternoonEnd} onChange={(e) => setAfternoonEnd(e.target.value)} />
          </div>
        </div>
        {!valid && (
          <p className="text-[11px] text-[var(--color-danger)]">
            Each block needs end &gt; start, and afternoon must start after morning ends.
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="edit-slot">Slot length</Label>
          <select
            id="edit-slot"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
          >
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-notes">Notes (optional)</Label>
          <Textarea
            id="edit-notes"
            placeholder="Visible only to the front desk · e.g. no telehealth this day"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={save} disabled={!valid}>Save changes</Button>
      </DialogFooter>
    </>
  );
}
