"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock3,
  MapPin,
  Stethoscope,
  Mail,
  Phone,
  Building2,
  ClipboardList,
  FileText,
  Bell,
  CheckCircle2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SecurityBadge } from "@/components/shared/security-badge";
import { AddToCalendar } from "@/components/shared/add-to-calendar";
import { RescheduleDialog, CancelAppointmentDialog } from "@/components/shared/form-dialogs";
import { usePatientStore, type Appointment, type PatientDocument } from "@/lib/patient-store";
import { toEventStart } from "@/lib/calendar-export";

function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s*/, "")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function dateLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const ms = new Date(iso + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { state, rescheduleAppointment, cancelAppointment, addNotification } = usePatientStore();

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const apt = state.appointments.find((a) => a.id === id);
  if (!apt) return <NotFound id={id} />;

  const docs = state.documents.filter((d) => apt.documentIds.includes(d.id));
  const days = daysUntil(apt.date);
  const isPast = apt.status === "completed" || apt.status === "cancelled" || apt.status === "no-show" || apt.status === "rejected";

  const statusBadge =
    apt.status === "confirmed" ? (
      <Badge variant="info" size="sm" dot>
        Confirmed{days >= 0 ? ` · in ${days} day${days === 1 ? "" : "s"}` : ""}
      </Badge>
    ) : apt.status === "requested" ? (
      <Badge variant="warning" size="sm" dot>Requested</Badge>
    ) : apt.status === "completed" ? (
      <Badge variant="success" size="sm" dot>Completed</Badge>
    ) : apt.status === "cancelled" ? (
      <Badge variant="muted" size="sm" dot>Cancelled</Badge>
    ) : apt.status === "rejected" ? (
      <Badge variant="danger" size="sm" dot>Declined by clinician</Badge>
    ) : (
      <Badge variant="danger" size="sm" dot>No-show</Badge>
    );

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/patient/appointments" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Appointments
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{id}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[oklch(0.96_0.025_235)] p-6">
            <div className="pointer-events-none absolute -right-20 -top-12 size-48 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_235)] to-transparent opacity-25 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <Avatar className="size-14">
                <AvatarFallback>{initials(apt.clinician)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                {statusBadge}
                <h1 className="mt-2 text-xl font-semibold tracking-tight">
                  {apt.clinician} · {apt.department}
                </h1>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {apt.reason} · 15-minute slot
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Box icon={Calendar} label="Date" value={dateLabel(apt.date)} />
              <Box icon={Clock3} label="Time" value={apt.time} />
              <Box
                icon={apt.mode === "telehealth" ? Video : MapPin}
                label="Location"
                value={apt.mode === "telehealth" ? "Telehealth · video link 1h before" : `${apt.department} Wing`}
              />
            </div>
            {!isPast && (
              <div className="mt-4 flex flex-wrap gap-2">
                <RescheduleDialog
                  triggerLabel={<><Calendar /> Reschedule</>}
                  triggerProps={{ variant: "outline", size: "sm" }}
                  appointment={{ id: apt.id, doctor: apt.clinician, date: dateLabel(apt.date), time: apt.time }}
                  onConfirm={(slot) => {
                    rescheduleAppointment(apt.id, apt.date, slot);
                    toast.success("Appointment rescheduled", { description: `New slot: ${slot} · reminders updated` });
                  }}
                />
                <AddToCalendar
                  event={{
                    id: apt.id,
                    title: `${apt.clinician} · ${apt.department}`,
                    start: toEventStart(apt.date, apt.time),
                    durationMinutes: 15,
                    location:
                      apt.mode === "telehealth"
                        ? "Telehealth (video link)"
                        : `${apt.department} Wing`,
                    description: apt.reason,
                  }}
                  filename={`appointment-${apt.id}`}
                  triggerProps={{ variant: "outline", size: "sm" }}
                />
                <CancelAppointmentDialog
                  triggerLabel="Cancel appointment"
                  triggerProps={{
                    variant: "ghost",
                    size: "sm",
                    className: "text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]",
                  }}
                  appointment={{ id: apt.id, reason: apt.reason, date: dateLabel(apt.date), time: apt.time, doctor: apt.clinician }}
                  onConfirm={(reason) => {
                    cancelAppointment(apt.id);
                    addNotification({
                      title: "Appointment cancelled",
                      body: `${apt.clinician} · ${dateLabel(apt.date)}`,
                      type: "appointment",
                    });
                    toast.warning("Appointment cancelled", {
                      description: reason ? `Reason: ${reason}` : "Reminder jobs cancelled · audit-logged",
                    });
                    router.push("/patient/appointments");
                  }}
                />
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold">Your reason for visiting</h2>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{apt.reason}</p>
            {docs.length > 0 && (
              <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Attached ({docs.length})
                </p>
                {docs.map((d) => (
                  <AttachmentRow key={d.id} doc={d} />
                ))}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold">Lifecycle</h2>
            <ol className="mt-4 space-y-3.5">
              {timeline(apt).map((e, i) => {
                const Icon = e.icon;
                return (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${e.done ? "bg-[var(--color-success-soft)] text-[var(--color-success)]" : "border border-dashed border-[var(--color-border)] text-[var(--color-muted-foreground)]"}`}>
                      <Icon className="size-3.5" />
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm ${e.done ? "" : "text-[var(--color-muted-foreground)]"}`}>{e.label}</p>
                      <p className="text-[10px] text-[var(--color-muted-foreground)]">{e.t}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Your clinician</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarFallback>{initials(apt.clinician)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{apt.clinician}</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{apt.department}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-xs text-[var(--color-muted-foreground)]">
              <li className="inline-flex items-center gap-2"><Building2 className="size-3.5" /> City General Hospital</li>
              <li className="inline-flex items-center gap-2"><Stethoscope className="size-3.5" /> {apt.department}</li>
              <li className="inline-flex items-center gap-2"><Mail className="size-3.5" /> Reach via secure messaging</li>
              <li className="inline-flex items-center gap-2"><Phone className="size-3.5" /> Reception · +91 22 4567 8910</li>
            </ul>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/patient/messages">Send a message</Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Pre-visit checklist</p>
            <ul className="mt-3 space-y-2">
              {[
                "Bring photo ID and insurance card",
                "Fast 12 hours if labs are scheduled",
                "List current medications and dosages",
                "Note any new symptoms since last visit",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)]" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Privacy</p>
            <p className="mt-2 text-[var(--color-muted-foreground)]">
              This appointment shares your name and contact info with {apt.clinician}&apos;s
              scheduling system. Clinical content remains in HealthSecure under
              your active consent.
            </p>
            <div className="mt-3 flex gap-2">
              <SecurityBadge variant="consent-bound" />
              <SecurityBadge variant="audited" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function timeline(apt: Appointment) {
  const created = new Date(apt.createdAt);
  const createdLabel = created.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return [
    { icon: CheckCircle2, label: `Requested`, t: createdLabel, done: true },
    {
      icon: CheckCircle2,
      label: "Confirmed by clinic",
      t: apt.status !== "requested" ? createdLabel : "Pending",
      done: apt.status !== "requested",
    },
    { icon: Bell, label: "Reminder T-24h", t: `Scheduled · ${dateLabel(apt.date)}`, done: apt.status === "completed" },
    { icon: Bell, label: "Reminder T-1h", t: `Scheduled · ${dateLabel(apt.date)}`, done: apt.status === "completed" },
    {
      icon: ClipboardList,
      label: apt.status === "cancelled" ? "Cancelled" : "Visit completed",
      t: apt.status === "completed" ? dateLabel(apt.date) : apt.status === "cancelled" ? "Cancelled" : "Pending",
      done: apt.status === "completed" || apt.status === "cancelled",
    },
  ];
}

function Box({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/70 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <Icon className="size-3.5" /> {label}
      </div>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function AttachmentRow({ doc }: { doc: PatientDocument }) {
  const sizeKb = Math.max(1, Math.round(doc.sizeBytes / 1024));
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[var(--color-card)] p-3">
      <span className="flex size-8 items-center justify-center rounded-md bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
        <FileText className="size-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{doc.name}</p>
        <p className="text-[10px] text-[var(--color-muted-foreground)]">
          {sizeKb} KB · {doc.scanStatus === "clean" ? "scanned clean" : "scan pending"} · audit-logged
        </p>
      </div>
      <SecurityBadge variant="encrypted" />
    </div>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/patient/appointments" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Appointments
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{id}</span>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
          <Calendar className="size-5" />
        </div>
        <p className="text-sm font-medium">Appointment not found</p>
        <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
          The appointment <code className="font-mono">{id}</code> doesn&apos;t exist or has been removed.
        </p>
        <Button asChild size="sm">
          <Link href="/patient/appointments">Back to appointments</Link>
        </Button>
      </div>
    </div>
  );
}
