"use client";

import Link from "next/link";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  Calendar,
  FileText,
  Shield,
  MessageSquare,
  ArrowRight,
  Stethoscope,
  Activity,
  Beaker,
  Pill,
  FileImage,
  ClipboardList,
  Plus,
  Sparkles,
  Clock3,
  CheckCircle2,
  ScrollText,
  DownloadCloud,
  CalendarPlus,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ActionButton } from "@/components/shared/action-button";
import { ConsentRequestDialog, CancelAppointmentDialog, RescheduleDialog } from "@/components/shared/form-dialogs";
import { CompleteProfileCard } from "./complete-profile-card";
import { usePatientStore, type Appointment, type MessageThread } from "@/lib/patient-store";

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
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function daysUntil(iso: string): number {
  return Math.round((new Date(iso + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
}

function isPast(a: Appointment): boolean {
  return a.status === "completed" || a.status === "cancelled" || a.status === "no-show";
}

export default function PatientDashboard() {
  const { state } = usePatientStore();

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const upcoming = state.appointments
    .filter((a) => !isPast(a))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const next = upcoming[0];
  const pendingConsents = 0; // pending consent requests are demo-only, not in the store
  const unreadThreads = state.threads.filter((t) => t.unread).length;

  return (
    <>
      <GreetingHero firstName={state.profile.firstName} next={next} unread={unreadThreads} pending={pendingConsents} />
      <QuickStats
        appointments={upcoming.length}
        consents={state.consents.filter((c) => c.status === "active").length}
        documents={state.documents.length}
        unread={unreadThreads}
      />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <UpcomingAppointments appts={upcoming} />
          <RecentRecords />
        </div>
        <div className="space-y-5">
          <CompleteProfileCard />
          <PendingConsents />
          <UnreadMessages threads={state.threads} />
          <ActivityFeed />
        </div>
      </div>
    </>
  );
}

function GreetingHero({ firstName, next, unread, pending }: { firstName: string; next?: Appointment; unread: number; pending: number }) {
  const summary = (() => {
    const parts: string[] = [];
    if (next) {
      const d = daysUntil(next.date);
      parts.push(
        `Your next appointment with ${next.clinician} is ${d <= 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`}`,
      );
    } else {
      parts.push("You don't have any upcoming appointments");
    }
    if (pending > 0) parts.push(`${pending} pending consent request${pending === 1 ? "" : "s"}`);
    if (unread > 0) parts.push(`${unread} unread message thread${unread === 1 ? "" : "s"}`);
    return parts.join(" · ") + ".";
  })();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[oklch(0.96_0.025_200)] p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_200)] to-transparent opacity-25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-32 size-44 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_158)] to-transparent opacity-20 blur-3xl" />

      <div className="relative grid gap-5 sm:grid-cols-[1.4fr_1fr] sm:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · Welcome back
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-[var(--color-muted-foreground)]">{summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/patient/appointments/new">
                <Plus /> Book appointment
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/patient/consents/grant">
                <Shield /> Review consents
              </Link>
            </Button>
          </div>
        </div>

        {next ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Next appointment
              </p>
              {next.status === "confirmed" ? (
                <Badge variant="info" size="sm" dot>Confirmed</Badge>
              ) : (
                <Badge variant="warning" size="sm" dot>Requested</Badge>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback>{initials(next.clinician)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{next.clinician}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{next.department}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[var(--color-muted-foreground)]">
                <Calendar className="size-3.5" />
                {dateLabel(next.date)} · {next.time}
              </div>
              <Link href={`/patient/appointments/${next.id}`} className="font-medium text-[var(--color-primary-700)] hover:underline">
                Details →
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center">
            <CalendarPlus className="mx-auto size-7 text-[var(--color-primary-700)]" />
            <p className="mt-2 text-sm font-semibold">No upcoming appointments</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">Book your first visit when ready.</p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/patient/appointments/new"><Plus /> Book appointment</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickStats({ appointments, consents, documents, unread }: { appointments: number; consents: number; documents: number; unread: number }) {
  const stats = [
    { label: "Documents", value: documents, sub: documents === 0 ? "Upload to get started" : "in your vault", icon: FileText, accent: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]" },
    { label: "Appointments", value: appointments, sub: appointments === 0 ? "None scheduled" : "upcoming", icon: Calendar, accent: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]" },
    { label: "Active consents", value: consents, sub: consents === 0 ? "None granted yet" : "clinicians can read", icon: Shield, accent: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]" },
    { label: "Unread messages", value: unread, sub: unread === 0 ? "Inbox is clear" : "thread(s)", icon: MessageSquare, accent: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{s.label}</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{s.sub}</p>
              </div>
              <span className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.accent} text-white shadow-[var(--shadow-soft)]`}>
                <Icon className="size-4.5" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UpcomingAppointments({ appts }: { appts: Appointment[] }) {
  const { rescheduleAppointment, cancelAppointment } = usePatientStore();
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Upcoming appointments</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Quick actions inline · reminder T-24h and T-1h</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/patient/appointments">View all <ArrowRight /></Link>
        </Button>
      </div>
      {appts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
            <CalendarPlus className="size-5" />
          </div>
          <p className="text-sm font-medium">No appointments yet</p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            Book your first appointment with one of our clinicians.
          </p>
          <Button asChild size="sm" className="mt-1">
            <Link href="/patient/appointments/new"><Plus /> Book appointment</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {appts.slice(0, 3).map((a) => (
            <li key={a.id} className="flex items-center gap-4 p-5 transition-colors hover:bg-[var(--color-muted)]/40">
              <Avatar className="size-11">
                <AvatarFallback>{initials(a.clinician)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{a.clinician}</p>
                  {a.status === "confirmed" ? (
                    <Badge variant="info" size="sm" dot>Confirmed</Badge>
                  ) : (
                    <Badge variant="warning" size="sm" dot>Requested</Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">{a.department}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
                  <span className="inline-flex items-center gap-1"><Calendar className="size-3.5" />{dateLabel(a.date)}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{a.time}</span>
                  <span className="inline-flex items-center gap-1"><Stethoscope className="size-3.5" />{a.mode === "telehealth" ? "Telehealth" : "In-person"}</span>
                </div>
              </div>
              <div className="hidden flex-col gap-1.5 sm:flex">
                <RescheduleDialog
                  triggerProps={{ variant: "outline", size: "sm" }}
                  appointment={{ id: a.id, doctor: a.clinician, date: dateLabel(a.date), time: a.time }}
                  onConfirm={(slot) => {
                    rescheduleAppointment(a.id, a.date, slot);
                    toast.success("Appointment rescheduled", { description: `New slot: ${slot}` });
                  }}
                />
                <CancelAppointmentDialog
                  triggerLabel="Cancel"
                  triggerProps={{
                    variant: "ghost",
                    size: "sm",
                    className: "text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]",
                  }}
                  appointment={{ id: a.id, reason: a.reason, date: dateLabel(a.date), time: a.time, doctor: a.clinician }}
                  onConfirm={() => {
                    cancelAppointment(a.id);
                    toast.warning("Appointment cancelled");
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentRecords() {
  // Records data lives in app/patient/records/records-data.ts (already-built
  // surface). This snapshot is a static highlight; the full filterable list
  // is on /patient/records.
  const records = [
    { id: "rec-lp-0518", title: "Lipid panel", category: "Lab Report", clinician: "Dr. Priya Shah", date: "May 18, 2026", icon: Beaker, status: "verified" as const, color: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]" },
    { id: "rec-rx-0512", title: "Atorvastatin 20mg", category: "Prescription", clinician: "Dr. Priya Shah", date: "May 12, 2026", icon: Pill, status: "encrypted" as const, color: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]" },
    { id: "rec-img-0501", title: "Chest X-ray", category: "Imaging", clinician: "Radiology Dept.", date: "May 1, 2026", icon: FileImage, status: "consent-bound" as const, color: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]" },
    { id: "rec-ds-0420", title: "Discharge summary", category: "Discharge", clinician: "Dr. Rohan Iyer", date: "Apr 20, 2026", icon: ClipboardList, status: "verified" as const, color: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]" },
  ];

  function downloadRecordPdf(r: (typeof records)[number]) {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(r.title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(110);
    doc.text(`${r.category} · ${r.clinician}`, 14, 30);
    doc.text(`Authored: ${r.date}`, 14, 37);
    doc.text(`Record ID: ${r.id}`, 14, 44);
    doc.setTextColor(20);
    doc.setFontSize(11);
    doc.text("Summary", 14, 58);
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text("This is a one-page summary exported from the patient dashboard.", 14, 66);
    doc.text(`Full record at /patient/records/${r.id}`, 14, 73);
    doc.save(`${r.id}.pdf`);
    toast.success(`Downloaded ${r.title}.pdf`, { description: "Audit-logged" });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Recent records</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Read-only · finalized notes are immutable</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/patient/records">Browse <ArrowRight /></Link>
        </Button>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {records.map((r) => {
          const Icon = r.icon;
          return (
            <li key={r.id} className="group flex items-center gap-4 p-5 transition-colors hover:bg-[var(--color-muted)]/40">
              <span className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${r.color} text-white shadow-[var(--shadow-soft)]`}>
                <Icon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <Badge variant="muted" size="sm">{r.category}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {r.clinician} · {r.date} · <span className="font-mono">{r.id}</span>
                </p>
              </div>
              <SecurityBadge variant={r.status} className="hidden sm:inline-flex" />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Download ${r.title}`}
                onClick={() => downloadRecordPdf(r)}
              >
                <DownloadCloud />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PendingConsents() {
  const { addConsent, addNotification } = usePatientStore();
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Pending consent</h2>
        <Badge variant="warning" size="sm" dot>1 request</Badge>
      </div>
      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/40 p-4">
          <div className="flex items-start gap-3">
            <Avatar className="size-9">
              <AvatarFallback>NK</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-semibold">Dr. Neha Kapoor</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Requested access to <em>Imaging</em> records.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <ConsentRequestDialog
              requester="Dr. Neha Kapoor"
              scope="Imaging"
              triggerLabel="Approve"
              triggerProps={{
                size: "sm",
                className: "flex-1",
                onClick: () => {
                  const con = addConsent({
                    clinician: "Dr. Neha Kapoor",
                    department: "Dermatology",
                    scopes: ["imaging"],
                    policyVersion: "v2.4",
                    expiresAt: null,
                  });
                  addNotification({
                    title: "Consent granted",
                    body: "Dr. Neha Kapoor · Imaging",
                    type: "consent",
                    href: `/patient/consents/${con.id}`,
                  });
                },
              }}
            />
            <ActionButton
              variant="outline"
              size="sm"
              className="flex-1"
              toastMessage="Request declined"
              toastDescription="Dr. Neha Kapoor will be notified"
              toastVariant="info"
            >
              Decline
            </ActionButton>
          </div>
        </div>

        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/patient/consents">Manage all consents <ArrowRight /></Link>
        </Button>
      </div>
    </div>
  );
}

function UnreadMessages({ threads }: { threads: MessageThread[] }) {
  const unread = threads.filter((t) => t.unread);
  const recent = threads
    .slice()
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
    .slice(0, 2);
  const display = unread.length > 0 ? unread.slice(0, 2) : recent;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">{unread.length > 0 ? "Unread messages" : "Recent messages"}</h2>
        {unread.length > 0 ? (
          <Badge variant="danger" size="sm" dot>{unread.length} new</Badge>
        ) : (
          <Badge variant="muted" size="sm">Inbox clear</Badge>
        )}
      </div>
      {display.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <Inbox className="size-6 text-[var(--color-muted-foreground)]" />
          <p className="text-xs text-[var(--color-muted-foreground)]">No conversations yet</p>
          <Button asChild variant="ghost" size="sm">
            <Link href="/patient/messages">Start one →</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {display.map((t) => {
            const last = t.messages[t.messages.length - 1];
            return (
              <li key={t.id}>
                <Link
                  href={`/patient/messages/${t.id}`}
                  className="flex items-start gap-3 p-4 transition-colors hover:bg-[var(--color-muted)]/40"
                >
                  <Avatar className="size-8">
                    <AvatarFallback>{initials(t.with)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{t.with}</p>
                      <span className="text-[10px] text-[var(--color-muted-foreground)]">{new Date(t.lastActivity).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    <p className="line-clamp-2 text-xs text-[var(--color-muted-foreground)]">{last?.body ?? "No messages yet"}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ActivityFeed() {
  const events = [
    { icon: CheckCircle2, t: "Consent granted to Dr. Shah", sub: "scope: lab + prescriptions", color: "text-[var(--color-success)] bg-[var(--color-success-soft)]" },
    { icon: DownloadCloud, t: "Downloaded lipid panel PDF", sub: "audit-logged", color: "text-[var(--color-info)] bg-[var(--color-info-soft)]" },
    { icon: Activity, t: "Signed in from Chrome · Mumbai", sub: "4 active sessions", color: "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]" },
    { icon: ScrollText, t: "Reviewed policy v2.4", sub: "May 17", color: "text-[var(--color-muted-foreground)] bg-[var(--color-muted)]" },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Activity</h2>
        <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
          <Sparkles className="size-3 text-[var(--color-primary)]" /> Audit-tracked
        </span>
      </div>
      <ul className="space-y-3 p-5">
        {events.map((e, i) => {
          const Icon = e.icon;
          return (
            <li key={i} className="flex items-start gap-3">
              <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${e.color}`}>
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{e.t}</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{e.sub}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
