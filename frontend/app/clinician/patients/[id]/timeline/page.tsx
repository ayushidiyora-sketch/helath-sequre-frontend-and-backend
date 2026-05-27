"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  Calendar,
  FileText,
  Pill,
  FileImage,
  ScrollText,
  ShieldCheck,
  Search,
  Filter,
  Stethoscope,
  ClipboardList,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";
import { useClinicianStore, type AssignedPatient } from "@/lib/clinician-store";

type EventKind = "assignment" | "appointment" | "note" | "rx" | "document" | "consent";
type KindFilter = "all" | EventKind;
type Range = "7d" | "30d" | "90d" | "all";

interface TimelineEvent {
  id: string;
  kind: EventKind;
  title: string;
  subtitle: string;
  at: string;
  href?: string;
  tone: "muted" | "info" | "success" | "warning" | "danger" | "primary";
}

const KIND_FILTERS: { value: KindFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "all", label: "All", icon: Activity },
  { value: "appointment", label: "Appointments", icon: Calendar },
  { value: "note", label: "Notes", icon: FileText },
  { value: "rx", label: "Prescriptions", icon: Pill },
  { value: "document", label: "Documents", icon: FileImage },
  { value: "consent", label: "Consents", icon: ShieldCheck },
];

const RANGE_FILTERS: { value: Range; label: string; days: number | null }[] = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "all", label: "All time", days: null },
];

function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function dayHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === yest.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function toneClasses(tone: TimelineEvent["tone"]): string {
  switch (tone) {
    case "success": return "text-[var(--color-success)] bg-[var(--color-success-soft)]/60";
    case "warning": return "text-[var(--color-warning-foreground)] bg-[var(--color-warning-soft)]/60";
    case "danger": return "text-[var(--color-danger)] bg-[var(--color-danger-soft)]/60";
    case "info": return "text-[var(--color-info)] bg-[var(--color-info-soft)]/60";
    case "primary": return "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]";
    default: return "text-[var(--color-muted-foreground)] bg-[var(--color-muted)]";
  }
}

function iconFor(kind: EventKind): React.ComponentType<{ className?: string }> {
  switch (kind) {
    case "appointment": return Calendar;
    case "note": return FileText;
    case "rx": return Pill;
    case "document": return FileImage;
    case "consent": return ShieldCheck;
    default: return ScrollText;
  }
}

export default function PatientTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state } = useClinicianStore();

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [range, setRange] = useState<Range>("30d");

  const patient = state.hydrated ? state.assignedPatients.find((p) => p.id === id) : undefined;

  const events = useMemo<TimelineEvent[]>(() => {
    if (!patient) return [];
    const out: TimelineEvent[] = [];

    out.push({
      id: `assign-${patient.id}`,
      kind: "assignment",
      title: "Patient assigned to your panel",
      subtitle: "By Org Admin",
      at: patient.assignedAt,
      tone: "muted",
    });

    for (const a of state.appointments.filter((x) => x.patientId === patient.id)) {
      const completed = a.status === "completed";
      const cancelled = a.status === "cancelled" || a.status === "no-show";
      out.push({
        id: `apt-${a.id}`,
        kind: "appointment",
        title: `${completed ? "Completed" : cancelled ? "Cancelled" : "Scheduled"}: ${a.reason}`,
        subtitle: `${a.time} · ${a.durationMinutes} min · ${a.mode === "telehealth" ? "Telehealth" : "In-person"}`,
        at: a.completedAt ?? a.startedAt ?? `${a.date}T${convertTime(a.time)}`,
        href: `/clinician/appointments/${a.id}`,
        tone: completed ? "success" : cancelled ? "danger" : "info",
      });
    }

    for (const n of state.notes.filter((x) => x.patientId === patient.id)) {
      out.push({
        id: `note-${n.id}`,
        kind: "note",
        title: `${n.template} note · v${n.version} ${n.status === "finalized" ? "finalized" : "drafted"}`,
        subtitle: "By you",
        at: n.finalizedAt ?? n.updatedAt,
        href: `/clinician/notes/new?patient=${patient.id}&note=${n.id}`,
        tone: n.status === "finalized" ? "success" : "warning",
      });
    }

    for (const r of state.prescriptions.filter((x) => x.patientId === patient.id)) {
      out.push({
        id: `rx-${r.id}`,
        kind: "rx",
        title: `${r.medication || "Untitled draft"}${r.dose ? ` · ${r.dose}` : ""} ${r.status === "finalized" ? "prescribed" : "drafted"}`,
        subtitle: r.frequency || "By you",
        at: r.finalizedAt ?? r.createdAt,
        href: `/clinician/prescriptions/${r.id}`,
        tone: "primary",
      });
    }

    for (const d of state.documents.filter((x) => x.patientId === patient.id)) {
      out.push({
        id: `doc-${d.id}`,
        kind: "document",
        title: `${d.name} uploaded`,
        subtitle: `${d.category} · ${(d.sizeBytes / 1024).toFixed(0)} KB · by ${d.uploaderName}`,
        at: d.uploadedAt,
        href: `/clinician/patients/${patient.id}/documents`,
        tone: "info",
      });
    }

    for (const r of state.accessRequests.filter((x) => x.patientId === patient.id)) {
      const labels: Record<string, { title: string; tone: TimelineEvent["tone"] }> = {
        pending: { title: "Sensitive-access request pending review", tone: "warning" },
        approved: { title: "Sensitive-access request approved", tone: "success" },
        rejected: { title: "Sensitive-access request rejected", tone: "danger" },
        expired: { title: "Sensitive-access window expired", tone: "muted" },
      };
      const meta = labels[r.status] ?? labels.pending;
      out.push({
        id: `ar-${r.id}`,
        kind: "consent",
        title: meta.title,
        subtitle: `${r.scopes.length} scope${r.scopes.length === 1 ? "" : "s"} · ${r.durationHours}h window`,
        at: r.decidedAt ?? r.requestedAt,
        tone: meta.tone,
      });
    }

    out.sort((a, b) => b.at.localeCompare(a.at));
    return out;
  }, [patient, state.appointments, state.notes, state.prescriptions, state.documents, state.accessRequests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rangeMeta = RANGE_FILTERS.find((r) => r.value === range);
    const cutoffMs = rangeMeta?.days != null ? Date.now() - rangeMeta.days * 24 * 60 * 60 * 1000 : null;
    return events
      .filter((e) => (kindFilter === "all" ? true : e.kind === kindFilter))
      .filter((e) => (cutoffMs == null ? true : Date.parse(e.at) >= cutoffMs))
      .filter((e) => (!q ? true : e.title.toLowerCase().includes(q) || e.subtitle.toLowerCase().includes(q)));
  }, [events, query, kindFilter, range]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of filtered) {
      const key = dayKey(e.at);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (!state.hydrated) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading…
      </div>
    );
  }

  if (!patient) {
    return <NotFound id={id} />;
  }

  const stats = {
    total: events.length,
    last7: events.filter((e) => Date.parse(e.at) >= Date.now() - 7 * 24 * 3600 * 1000).length,
    appointments: events.filter((e) => e.kind === "appointment").length,
    finalized: events.filter((e) => e.kind === "note" && e.tone === "success").length,
  };

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/clinician/patients" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Patient panel
        </Link>
        <span>/</span>
        <Link href={`/clinician/patients/${patient.id}`} className="hover:text-[var(--color-foreground)]">
          {patient.name}
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">Timeline</span>
      </div>

      <PageHeader
        eyebrow="Clinical timeline"
        title={`${patient.name} · Timeline`}
        description="Chronological view of every clinical event for this patient. Every entry is audit-logged with actor and timestamp."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={`/clinician/patients/${patient.id}`}>
              <Stethoscope /> Back to chart
            </Link>
          </Button>
        }
      />

      {/* Identity strip */}
      <PatientStrip patient={patient} />

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={Activity} label="Total events" value={stats.total} />
        <Stat icon={Clock} label="Last 7 days" value={stats.last7} tone="info" />
        <Stat icon={Calendar} label="Appointments" value={stats.appointments} />
        <Stat icon={CheckCircle2} label="Finalized notes" value={stats.finalized} tone="success" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search events…"
            leadingIcon={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-md"
          />
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList>
              {RANGE_FILTERS.map((r) => (
                <TabsTrigger key={r.value} value={r.value}>{r.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <Tabs value={kindFilter} onValueChange={(v) => setKindFilter(v as KindFilter)}>
          <TabsList className="flex-wrap">
            {KIND_FILTERS.map((k) => {
              const Icon = k.icon;
              return (
                <TabsTrigger key={k.value} value={k.value}>
                  <Icon /> {k.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
          <Activity className="size-6 text-[var(--color-muted-foreground)]" />
          <p className="text-sm font-medium">
            {events.length === 0 ? "No clinical activity recorded yet" : "No events match the current filters"}
          </p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            {events.length === 0
              ? "Once you schedule an appointment, finalize a note, or upload a document, it will appear here."
              : "Try clearing the search, switching the kind filter, or extending the time range."}
          </p>
          {events.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setQuery("");
                setKindFilter("all");
                setRange("all");
              }}
            >
              <Filter /> Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([key, dayEvents]) => (
            <section key={key}>
              <div className="flex items-baseline justify-between border-b border-[var(--color-border)] pb-2">
                <h2 className="text-sm font-semibold">{dayHeading(dayEvents[0].at)}</h2>
                <span className="text-[11px] text-[var(--color-muted-foreground)]">
                  {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                </span>
              </div>
              <ol className="relative mt-4 space-y-3 border-l border-[var(--color-border)] pl-6">
                {dayEvents.map((e) => {
                  const Icon = iconFor(e.kind);
                  return (
                    <li key={e.id} className="relative">
                      <span
                        className={`absolute -left-[34px] flex size-7 items-center justify-center rounded-full ring-4 ring-[var(--color-background)] ${toneClasses(e.tone)}`}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3.5 transition-colors hover:bg-[var(--color-muted)]/30">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{e.title}</p>
                            <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">
                              {e.subtitle} · {dateTimeLabel(e.at)}
                            </p>
                          </div>
                          {e.href && (
                            <Button asChild size="sm" variant="ghost">
                              <Link href={e.href}>Open</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          <div className="flex justify-end">
            <SecurityBadge variant="audited" />
          </div>
        </div>
      )}
    </>
  );
}

function PatientStrip({ patient }: { patient: AssignedPatient }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] to-[oklch(0.96_0.025_235)] p-4">
      <Avatar className="size-12"><AvatarFallback>{patient.initials}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{patient.name}</p>
          <Badge variant="muted" size="sm">{patient.age} · {patient.sex}</Badge>
          <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">{patient.mrn}</span>
          {patient.consentStatus === "active" ? (
            <SecurityBadge variant="consent-bound" />
          ) : (
            <Badge variant="danger" size="sm" dot>Consent revoked</Badge>
          )}
        </div>
        {patient.conditions && patient.conditions.length > 0 && (
          <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
            Conditions: {patient.conditions.join(", ")}
          </p>
        )}
      </div>
    </div>
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

function NotFound({ id }: { id: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/clinician/patients" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Patient panel
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{id}</span>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
        <ClipboardList className="size-6 text-[var(--color-muted-foreground)]" />
        <p className="text-sm font-medium">Patient not on your panel</p>
        <Button asChild size="sm"><Link href="/clinician/patients">Back to panel</Link></Button>
      </div>
    </div>
  );
}

// Converts "10:00 AM" → "10:00" (24h) so it can be appended to a yyyy-mm-dd
// for chronological sorting. Approximate — good enough for demo ordering.
function convertTime(time: string): string {
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return "00:00";
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = m[3]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}
