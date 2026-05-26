"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Calendar, Filter, ChevronRight, AlertCircle, CheckCircle2, Check, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/input";
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

type SlotStatus = "confirmed" | "no-show" | "blocked";

const SLOTS: { clinician: string; time: string; patient: string; status: SlotStatus; room: string }[] = [
  { clinician: "Dr. Priya Shah", time: "9:30 AM", patient: "Aarav Mehta", status: "confirmed", room: "304" },
  { clinician: "Dr. Rohan Iyer", time: "9:30 AM", patient: "Saanvi Sen", status: "confirmed", room: "Telehealth" },
  { clinician: "Dr. Neha Kapoor", time: "9:30 AM", patient: "Tarun Mehta", status: "no-show", room: "212" },
  { clinician: "Dr. Priya Shah", time: "9:45 AM", patient: "Neha Bansal", status: "confirmed", room: "304" },
  { clinician: "Dr. Rohan Iyer", time: "9:45 AM", patient: "—", status: "blocked", room: "—" },
  { clinician: "Dr. Neha Kapoor", time: "9:45 AM", patient: "Ayesha Khan", status: "confirmed", room: "212" },
];

const STATUS_FILTERS: { key: SlotStatus | "all"; label: string }[] = [
  { key: "all", label: "All appointments" },
  { key: "confirmed", label: "Confirmed" },
  { key: "no-show", label: "No-show" },
  { key: "blocked", label: "Blocked" },
];

export default function AdminAppointmentsPage() {
  const [statusFilter, setStatusFilter] = useState<SlotStatus | "all">("all");
  const [conflictResolved, setConflictResolved] = useState(false);

  const visible = SLOTS.filter((s) => statusFilter === "all" || s.status === statusFilter);

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Clinic-wide schedule"
        description="Override conflicts, reassign appointments between clinicians, and configure reminder windows."
        actions={
          <>
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
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Today total", value: 184 },
          { label: "Confirmed", value: 174, good: true },
          { label: "No-shows so far", value: 4, warn: true },
          { label: "Telehealth", value: 36 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.good ? "text-[var(--color-success)]" : s.warn ? "text-[var(--color-warning)]" : ""}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Conflict banner */}
      {conflictResolved ? (
        <div className="rounded-2xl border border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/30 p-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-card)] text-[var(--color-success)] ring-1 ring-[var(--color-success)]/30">
              <CheckCircle2 className="size-4" />
            </span>
            <div>
              <p className="font-semibold">Conflict resolved</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                11:00 AM appointment reassigned to Dr. Rohan Iyer · everyone notified.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/30 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-card)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)] ring-1 ring-[var(--color-warning)]/30">
              <AlertCircle className="size-4" />
            </span>
            <div className="text-xs">
              <p className="text-sm font-semibold">Conflict detected</p>
              <p className="mt-0.5 text-[var(--color-muted-foreground)]">
                Dr. Priya Shah has two appointments at 11:00 AM. Reassign one to Dr. Rohan Iyer (open slot).
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setConflictResolved(true);
                  toast.success("Conflict resolved", {
                    description: "Reassigned to Dr. Iyer · patient + both clinicians notified",
                  });
                }}
              >
                Resolve
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="grid grid-cols-12 gap-4 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <div className="col-span-2">Time</div>
          <div className="col-span-3">Clinician</div>
          <div className="col-span-3">Patient</div>
          <div className="col-span-2">Room</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">No appointments match.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {visible.map((s, i) => (
              <li key={i} className="grid grid-cols-12 items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-muted)]/40">
                <div className="col-span-2 font-mono text-sm">{s.time}</div>
                <div className="col-span-3 text-sm">{s.clinician}</div>
                <div className="col-span-3 text-sm">{s.patient}</div>
                <div className="col-span-2 text-xs text-[var(--color-muted-foreground)]">{s.room}</div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  {s.status === "confirmed" && <Badge variant="info" size="sm" dot>Confirmed</Badge>}
                  {s.status === "no-show" && <Badge variant="danger" size="sm" dot>No-show</Badge>}
                  {s.status === "blocked" && <Badge variant="warning" size="sm" dot>Blocked</Badge>}
                  <ChevronRight className="size-4 text-[var(--color-muted-foreground)]" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ConfigureRemindersDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Calendar /> Configure reminders
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
            toast.success("Reminder settings saved", { description: "Applies to all upcoming appointments" });
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
                <span className="block text-[11px] text-[var(--color-muted-foreground)]">{r.desc}</span>
              </span>
              <Switch defaultChecked={r.on} />
            </label>
          ))}
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="rem-channel">Delivery channel</Label>
            <select
              id="rem-channel"
              className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
              defaultValue="Email + SMS"
            >
              <option>Email only</option>
              <option>SMS only</option>
              <option>Email + SMS</option>
            </select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">
              <Bell /> Save reminders
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
