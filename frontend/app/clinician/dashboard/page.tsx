"use client";

import { useEffect, useState } from "react";
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
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SecurityBadge } from "@/components/shared/security-badge";

interface DashboardProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string | null;
  department: string | null;
  profilePhotoUrl: string | null;
  tenantName: string | null;
}

interface DashboardStats {
  todayCount: number;
  completedToday: number;
  panelSize: number;
  pendingTasks: number;
  activePrescriptions: number;
}

interface DashboardAppointment {
  id: string;
  patientName: string | null;
  patientEmail: string | null;
  startsAt: string;
  time: string;
  durationMinutes: number;
  room: string | null;
  status: "confirmed" | "no_show" | "blocked" | "cancelled" | "completed";
  notes: string | null;
}

interface DashboardPanelPatient {
  id: string;
  assignmentId: string;
  role: string | null;
  startedAt: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: string | null;
  dateOfBirth: string | null;
  profilePhotoUrl: string | null;
  status: string;
}

interface DashboardNextUp {
  id: string;
  patientName: string | null;
  time: string;
  durationMinutes: number;
  status: string;
  notes: string | null;
}

interface DashboardResponse {
  ok: true;
  profile: DashboardProfile;
  stats: DashboardStats;
  todayAppointments: DashboardAppointment[];
  panelPatients: DashboardPanelPatient[];
  nextUp: DashboardNextUp | null;
}

function initials(firstName: string, lastName: string): string {
  return ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase();
}

export default function ClinicianDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/clinician/dashboard", { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json();
        if (cancelled) return;
        if (!r.ok || !json.ok) {
          setError(json.error ?? `HTTP ${r.status}`);
          return;
        }
        setData(json as DashboardResponse);
      })
      .catch(() => {
        if (!cancelled) setError("Network error — could not load dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="size-4 animate-spin" /> Loading dashboard…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-6 text-sm text-[var(--color-danger)]">
        {error ?? "Could not load dashboard."}
      </div>
    );
  }

  return (
    <>
      <Hero
        firstName={data.profile.firstName}
        lastName={data.profile.lastName}
        nextUp={data.nextUp}
        unreadNotifications={0}
      />
      <Stats stats={data.stats} />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <TodayQueue appointments={data.todayAppointments} />
          <RecentPatients patients={data.panelPatients} />
        </div>
        <div className="space-y-5">
          <PendingTasksEmpty />
          <QuickActions />
          <NotificationsEmpty />
        </div>
      </div>
    </>
  );
}

function Hero({
  firstName,
  lastName,
  nextUp,
  unreadNotifications,
}: {
  firstName: string;
  lastName: string;
  nextUp: DashboardNextUp | null;
  unreadNotifications: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[oklch(0.96_0.025_235)] p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_235)] to-transparent opacity-25 blur-3xl" />
      <div className="relative grid gap-5 sm:grid-cols-[1.4fr_1fr] sm:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, Dr. {firstName} {lastName}.
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-[var(--color-muted-foreground)]">
            {nextUp
              ? `Next up: ${nextUp.patientName ?? "patient"} at ${nextUp.time}.`
              : "No more appointments today — focus time to clear pending tasks."}
            {unreadNotifications > 0 &&
              ` · ${unreadNotifications} unread notification${unreadNotifications === 1 ? "" : "s"}.`}
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

        {nextUp ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Next patient</p>
              <Badge variant="info" size="sm" dot>
                {nextUp.status === "confirmed" ? "Scheduled" : nextUp.status}
              </Badge>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback>
                  {nextUp.patientName
                    ? nextUp.patientName
                        .split(/\s+/)
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{nextUp.patientName ?? "—"}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {nextUp.notes ?? "Visit"} · {nextUp.durationMinutes} min
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 text-[var(--color-muted-foreground)]">
                <Clock3 className="size-3.5" /> {nextUp.time}
              </span>
              <Link href="/clinician/schedule" className="font-medium text-[var(--color-primary-700)] hover:underline">
                Open schedule →
              </Link>
            </div>
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

function Stats({ stats }: { stats: DashboardStats }) {
  const items = [
    {
      label: "Today's queue",
      value: stats.todayCount,
      sub: `${stats.completedToday} completed`,
      icon: Users,
      accent: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]",
    },
    {
      label: "Pending tasks",
      value: stats.pendingTasks,
      sub: stats.pendingTasks === 0 ? "All clear" : "open",
      icon: ClipboardList,
      accent: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]",
    },
    {
      label: "Panel size",
      value: stats.panelSize,
      sub: "assigned to you",
      icon: Users,
      accent: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]",
    },
    {
      label: "Active prescriptions",
      value: stats.activePrescriptions,
      sub: "finalized total",
      icon: Pill,
      accent: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => {
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

function TodayQueue({ appointments }: { appointments: DashboardAppointment[] }) {
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
            const ini = a.patientName
              ? a.patientName.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
              : "?";
            return (
              <li key={a.id}>
                <Link
                  href="/clinician/schedule"
                  className="group flex items-center gap-4 p-5 transition-colors hover:bg-[var(--color-muted)]/40"
                >
                  <Avatar className="size-10"><AvatarFallback>{ini}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{a.patientName ?? "—"}</p>
                      {a.status === "completed" && <Badge variant="success" size="sm" dot>Completed</Badge>}
                      {a.status === "no_show" && <Badge variant="danger" size="sm" dot>No-show</Badge>}
                      {a.status === "cancelled" && <Badge variant="muted" size="sm" dot>Cancelled</Badge>}
                      {a.status === "blocked" && <Badge variant="muted" size="sm" dot>Blocked</Badge>}
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{a.notes ?? "Visit"}</p>
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

function RecentPatients({ patients }: { patients: DashboardPanelPatient[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Assigned panel</h2>
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
          {patients.map((p) => {
            const ini = initials(p.firstName, p.lastName);
            const photo =
              p.profilePhotoUrl && /^(data:|https?:)/i.test(p.profilePhotoUrl)
                ? p.profilePhotoUrl
                : null;
            return (
              <li key={p.assignmentId}>
                <Link
                  href={`/clinician/patients/${p.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-[var(--color-muted)]/40"
                >
                  <Avatar className="size-9">
                    {photo && <AvatarImage src={photo} alt={p.name} />}
                    <AvatarFallback>{ini}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      {p.role && <Badge variant="muted" size="sm">{p.role}</Badge>}
                    </div>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">
                      {p.email}
                      {p.gender ? ` · ${p.gender}` : ""}
                    </p>
                  </div>
                  <div className="hidden items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)] sm:flex">
                    <SecurityBadge variant="consent-bound" label="Assigned" />
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

function PendingTasksEmpty() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Pending tasks</h2>
        <Badge variant="muted" size="sm">0</Badge>
      </div>
      <p className="p-8 text-center text-sm text-[var(--color-muted-foreground)]">
        All caught up — no pending tasks.
      </p>
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

function NotificationsEmpty() {
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
