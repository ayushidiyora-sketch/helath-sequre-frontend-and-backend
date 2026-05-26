"use client";

import Link from "next/link";
import {
  Calendar,
  Clock3,
  ClipboardList,
  MessageSquare,
  Pill,
  FileSignature,
  ChevronRight,
  ArrowRight,
  Users,
  Plus,
  Inbox,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ActionButton } from "@/components/shared/action-button";
import {
  useClinicianStore,
  type AssignedPatient,
  type ClinicianAppointment,
  type ClinicianTask,
  type ClinicianNotification,
} from "@/lib/clinician-store";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function relativeTime(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

function isToday(iso: string): boolean {
  return iso === new Date().toISOString().slice(0, 10);
}

export default function ClinicianDashboard() {
  const { state } = useClinicianStore();

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const todayAppointments = state.appointments
    .filter((a) => isToday(a.date))
    .sort((a, b) => a.time.localeCompare(b.time));
  const next = todayAppointments.find((a) => a.status !== "completed" && a.status !== "cancelled" && a.status !== "no-show");
  const openTasks = state.tasks.filter((t) => !t.completedAt);
  const unreadNotifications = state.notifications.filter((n) => !n.read);

  return (
    <>
      <Hero
        firstName={state.profile.firstName}
        lastName={state.profile.lastName}
        next={next}
        nextPatient={next ? state.assignedPatients.find((p) => p.id === next.patientId) : undefined}
        unreadNotifications={unreadNotifications.length}
      />
      <Stats
        todayCount={todayAppointments.length}
        completed={todayAppointments.filter((a) => a.status === "completed").length}
        pendingTasks={openTasks.length}
        prescriptions={state.prescriptions.filter((p) => p.status === "finalized").length}
        patients={state.assignedPatients.length}
      />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <TodayQueue appointments={todayAppointments} patients={state.assignedPatients} />
          <RecentPatients patients={state.assignedPatients} />
        </div>
        <div className="space-y-5">
          <PendingTasks tasks={openTasks} />
          <QuickActions />
          <Notifications notifications={unreadNotifications.slice(0, 3)} />
        </div>
      </div>
    </>
  );
}

function Hero({
  firstName,
  lastName,
  next,
  nextPatient,
  unreadNotifications,
}: {
  firstName: string;
  lastName: string;
  next?: ClinicianAppointment;
  nextPatient?: AssignedPatient;
  unreadNotifications: number;
}) {
  const minutesUntilNext = next ? Math.max(0, Math.round(((new Date(next.date + "T00:00:00").getTime() - Date.now()) / 60_000) % 1440)) : 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[oklch(0.96_0.025_235)] p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_235)] to-transparent opacity-25 blur-3xl" />
      <div className="relative grid gap-5 sm:grid-cols-[1.4fr_1fr] sm:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, Dr. {lastName}.
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-[var(--color-muted-foreground)]">
            {next
              ? `Next up: ${nextPatient?.name ?? "patient"} at ${next.time}.`
              : "No more appointments today — focus time to clear pending tasks."}
            {unreadNotifications > 0 && ` · ${unreadNotifications} unread notification${unreadNotifications === 1 ? "" : "s"}.`}
          </p>
          <p className="sr-only">{firstName}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/clinician/notes/new"><Plus /> New note</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/clinician/schedule"><Calendar /> View schedule</Link>
            </Button>
          </div>
        </div>

        {next && nextPatient ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Next patient</p>
              <Badge variant="info" size="sm" dot>
                {next.status === "in-progress" ? "In room" : next.status === "arrived" ? "Arrived" : "Scheduled"}
              </Badge>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Avatar className="size-10"><AvatarFallback>{nextPatient.initials}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{nextPatient.name}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{next.reason} · {next.durationMinutes} min</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 text-[var(--color-muted-foreground)]">
                <Clock3 className="size-3.5" /> {next.time}
              </span>
              <Link href={`/clinician/patients/${nextPatient.id}`} className="font-medium text-[var(--color-primary-700)] hover:underline">
                Open chart →
              </Link>
            </div>
            <p className="sr-only">{minutesUntilNext}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center">
            <CheckCircle2 className="mx-auto size-7 text-[var(--color-success)]" />
            <p className="mt-2 text-sm font-semibold">Clear queue</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">No upcoming patients today.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stats({
  todayCount,
  completed,
  pendingTasks,
  prescriptions,
  patients,
}: {
  todayCount: number;
  completed: number;
  pendingTasks: number;
  prescriptions: number;
  patients: number;
}) {
  const stats = [
    { label: "Today's queue", value: todayCount, sub: `${completed} completed`, icon: Users, accent: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]" },
    { label: "Pending tasks", value: pendingTasks, sub: pendingTasks === 0 ? "All clear" : "open", icon: ClipboardList, accent: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]" },
    { label: "Panel size", value: patients, sub: "assigned to you", icon: Users, accent: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]" },
    { label: "Active prescriptions", value: prescriptions, sub: "finalized total", icon: Pill, accent: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
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

function TodayQueue({ appointments, patients }: { appointments: ClinicianAppointment[]; patients: AssignedPatient[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Today&apos;s queue</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Status transitions are audit-logged</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/clinician/schedule">Full schedule <ArrowRight /></Link>
        </Button>
      </div>
      {appointments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <Calendar className="size-6 text-[var(--color-muted-foreground)]" />
          <p className="text-sm font-medium">No appointments scheduled today</p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            Enjoy the breathing room — or open Schedule to add availability.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {appointments.map((a) => {
            const p = patients.find((x) => x.id === a.patientId);
            return (
              <li key={a.id}>
                <Link
                  href={`/clinician/patients/${a.patientId}`}
                  className={`group flex items-center gap-4 p-5 transition-colors hover:bg-[var(--color-muted)]/40 ${a.status === "in-progress" ? "bg-[var(--color-primary-50)]/30" : ""}`}
                >
                  <Avatar className="size-10"><AvatarFallback>{p?.initials ?? "??"}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{p?.name ?? "Unknown"}</p>
                      <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{p?.mrn}</span>
                      {a.status === "in-progress" && <Badge variant="info" size="sm" dot>In room</Badge>}
                      {a.status === "arrived" && <Badge variant="warning" size="sm" dot>Arrived</Badge>}
                      {a.status === "completed" && <Badge variant="success" size="sm" dot>Completed</Badge>}
                      {a.status === "no-show" && <Badge variant="danger" size="sm" dot>No-show</Badge>}
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{a.reason}</p>
                  </div>
                  <div className="hidden text-right text-xs text-[var(--color-muted-foreground)] sm:block">
                    <p className="font-mono">{a.time}</p>
                    <p>{a.durationMinutes} min</p>
                  </div>
                  <ChevronRight className="size-4 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RecentPatients({ patients }: { patients: AssignedPatient[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Recent patients</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/clinician/patients">Open panel <ArrowRight /></Link>
        </Button>
      </div>
      {patients.length === 0 ? (
        <p className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">
          No patients on your panel yet. Org Admin assigns patients.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {patients.slice(0, 4).map((p) => (
            <li key={p.id}>
              <Link
                href={`/clinician/patients/${p.id}`}
                className="flex items-center gap-4 p-4 hover:bg-[var(--color-muted)]/40"
              >
                <Avatar className="size-9"><AvatarFallback>{p.initials}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    {p.consentStatus === "revoked" && <Badge variant="danger" size="sm" dot>Consent revoked</Badge>}
                  </div>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">MRN {p.mrn} · {p.conditions?.[0] ?? "—"}</p>
                </div>
                <div className="hidden items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)] sm:flex">
                  <SecurityBadge variant="consent-bound" label={`${p.consentScopes.length} scopes`} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PendingTasks({ tasks }: { tasks: ClinicianTask[] }) {
  const TASK_ICON = {
    sign_note: FileSignature,
    approve_rx: Pill,
    reply_message: MessageSquare,
    review_imaging: ClipboardList,
  } as const;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Pending tasks</h2>
        <Badge variant={tasks.length === 0 ? "muted" : "warning"} size="sm">{tasks.length}</Badge>
      </div>
      {tasks.length === 0 ? (
        <p className="p-8 text-center text-sm text-[var(--color-muted-foreground)]">All caught up — no pending tasks.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {tasks.slice(0, 5).map((t) => {
            const Icon = TASK_ICON[t.type];
            return (
              <li key={t.id} className="flex items-start gap-3 p-4 hover:bg-[var(--color-muted)]/40">
                <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${t.urgent ? "bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]" : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"}`}>
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  {t.href ? (
                    <Link href={t.href} className="text-xs font-medium hover:underline">{t.title}</Link>
                  ) : (
                    <p className="text-xs font-medium">{t.title}</p>
                  )}
                  <p className="text-[10px] text-[var(--color-muted-foreground)]">{t.subtitle}</p>
                </div>
                {t.urgent && <span className="size-1.5 rounded-full bg-[var(--color-warning)]" />}
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t border-[var(--color-border)] p-3 text-right">
        <Button asChild variant="ghost" size="sm">
          <Link href="/clinician/tasks">All tasks <ArrowRight /></Link>
        </Button>
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h2 className="text-sm font-semibold">Quick actions</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { label: "SOAP note", icon: FileSignature, href: "/clinician/notes/new" },
          { label: "Patient panel", icon: Users, href: "/clinician/patients" },
          { label: "Message patient", icon: MessageSquare, href: "/clinician/messages" },
          { label: "Block slot", icon: Calendar, href: "/clinician/schedule" },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm font-medium transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)]/40 hover:text-[var(--color-primary-700)]"
            >
              <Icon className="size-4 text-[var(--color-primary)]" /> {a.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Notifications({ notifications }: { notifications: ClinicianNotification[] }) {
  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center gap-2">
          <Inbox className="size-4 text-[var(--color-muted-foreground)]" />
          <h2 className="text-sm font-semibold">Notifications</h2>
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">You&apos;re all caught up.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <Badge variant="info" size="sm">{notifications.length} new</Badge>
      </div>
      <ul className="mt-3 space-y-2.5">
        {notifications.map((n) => (
          <li key={n.id}>
            {n.href ? (
              <Link href={n.href} className="block rounded-lg border border-[var(--color-border)] p-3 text-xs hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-muted)]/40">
                <p className="font-medium">{n.title}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{n.body}</p>
                <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">{relativeTime(n.createdAt)}</p>
              </Link>
            ) : (
              <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs">
                <p className="font-medium">{n.title}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{n.body}</p>
                <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">{relativeTime(n.createdAt)}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Button asChild variant="ghost" size="sm" className="mt-3 w-full">
        <Link href="/clinician/notifications">All notifications <ArrowRight /></Link>
      </Button>
    </div>
  );
}

void ActionButton; // kept for future use in inline notifications
