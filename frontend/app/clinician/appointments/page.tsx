"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Search,
  Filter,
  Video,
  MapPin,
  ChevronRight,
  Activity,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";
import {
  useClinicianStore,
  type AppointmentStatus,
  type ClinicianAppointment,
} from "@/lib/clinician-store";

type Range = "today" | "upcoming" | "past" | "all";

const STATUS_VARIANT: Record<AppointmentStatus, "info" | "warning" | "success" | "muted" | "danger"> = {
  requested: "muted",
  confirmed: "info",
  arrived: "warning",
  "in-progress": "success",
  completed: "success",
  cancelled: "muted",
  "no-show": "danger",
};

const RANGE_TABS: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

const STATUS_TABS: { value: "all" | AppointmentStatus; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "confirmed", label: "Confirmed" },
  { value: "arrived", label: "Arrived" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "no-show", label: "No-show" },
];

function dateLabel(yyyymmdd: string): string {
  return new Date(yyyymmdd + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ClinicianAppointmentsPage() {
  const { state } = useClinicianStore();
  const [range, setRange] = useState<Range>("today");
  const [statusFilter, setStatusFilter] = useState<"all" | AppointmentStatus>("all");
  const [query, setQuery] = useState("");

  const todayKey = todayIso();

  const patientById = useMemo(
    () => Object.fromEntries(state.assignedPatients.map((p) => [p.id, p])),
    [state.assignedPatients],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inRange = (a: ClinicianAppointment) => {
      if (range === "all") return true;
      if (range === "today") return a.date === todayKey;
      if (range === "upcoming") return a.date >= todayKey && a.status !== "completed" && a.status !== "cancelled" && a.status !== "no-show";
      return a.date < todayKey || a.status === "completed" || a.status === "no-show" || a.status === "cancelled";
    };
    return state.appointments
      .filter(inRange)
      .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
      .filter((a) => {
        if (!q) return true;
        const patient = patientById[a.patientId];
        return (
          a.reason.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          (patient?.name.toLowerCase().includes(q) ?? false) ||
          (patient?.mrn.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        if (a.date !== b.date) return range === "past" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
  }, [state.appointments, range, statusFilter, query, patientById, todayKey]);

  const stats = {
    today: state.appointments.filter((a) => a.date === todayKey).length,
    upcoming: state.appointments.filter((a) => a.date > todayKey).length,
    inProgress: state.appointments.filter((a) => a.status === "in-progress").length,
    completedToday: state.appointments.filter((a) => a.date === todayKey && a.status === "completed").length,
  };

  if (!state.hydrated) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading…
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Appointments"
        title="Encounter queue"
        description="Manage today's schedule, follow up on pending requests, and review past encounters. Every status change is audit-logged."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/clinician/schedule"><CalendarDays /> Calendar view</Link>
            </Button>
            <SecurityBadge variant="audited" />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={Calendar} label="Today" value={stats.today} />
        <Stat icon={Activity} label="In progress" value={stats.inProgress} tone="success" />
        <Stat icon={Clock} label="Upcoming" value={stats.upcoming} tone="info" />
        <Stat icon={Calendar} label="Completed today" value={stats.completedToday} tone="success" />
      </div>

      <div className="flex flex-col gap-3">
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            {RANGE_TABS.map((r) => (
              <TabsTrigger key={r.value} value={r.value}>{r.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by patient name, MRN, reason, or appointment ID…"
            leadingIcon={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-md"
          />
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | AppointmentStatus)}>
            <TabsList>
              {STATUS_TABS.map((s) => (
                <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
          <Calendar className="size-6 text-[var(--color-muted-foreground)]" />
          <p className="text-sm font-medium">No appointments match the current filters</p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            Try a different range or clear the search.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
              setRange("all");
            }}
          >
            <Filter /> Clear filters
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="grid grid-cols-12 gap-4 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            <div className="col-span-3">Patient</div>
            <div className="col-span-2">When</div>
            <div className="col-span-2">Reason</div>
            <div className="col-span-2">Mode</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Open</div>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {filtered.map((a) => {
              const patient = patientById[a.patientId];
              return (
                <li key={a.id}>
                  <Link
                    href={`/clinician/appointments/${a.id}`}
                    className="grid grid-cols-12 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-muted)]/40"
                  >
                    <div className="col-span-3 min-w-0">
                      <p className="truncate text-sm font-semibold">{patient?.name ?? a.patientId}</p>
                      <p className="font-mono text-[11px] text-[var(--color-muted-foreground)]">{patient?.mrn ?? "—"}</p>
                    </div>
                    <div className="col-span-2 text-xs">
                      <p className="font-medium">{dateLabel(a.date)}</p>
                      <p className="text-[var(--color-muted-foreground)]">{a.time} · {a.durationMinutes}m</p>
                    </div>
                    <div className="col-span-2 truncate text-xs text-[var(--color-muted-foreground)]">{a.reason}</div>
                    <div className="col-span-2 inline-flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
                      {a.mode === "telehealth"
                        ? <><Video className="size-3.5" /> Telehealth</>
                        : <><MapPin className="size-3.5" /> In-person</>}
                    </div>
                    <div className="col-span-2">
                      <Badge variant={STATUS_VARIANT[a.status]} size="sm" dot>{a.status.replace("-", " ")}</Badge>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <ChevronRight className="size-4 text-[var(--color-muted-foreground)]" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "success" | "info";
}) {
  const ring =
    tone === "success"
      ? "text-[var(--color-success)] bg-[var(--color-success-soft)]/50"
      : tone === "info"
        ? "text-[var(--color-info)] bg-[var(--color-info-soft)]/50"
        : "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <span className={`flex size-5 items-center justify-center rounded-md ${ring}`}>
          <Icon className="size-3" />
        </span>
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
