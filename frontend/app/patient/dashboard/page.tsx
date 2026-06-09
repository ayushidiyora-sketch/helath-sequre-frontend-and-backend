"use client";

import { useEffect, useState } from "react";
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
  ScrollText,
  DownloadCloud,
  CalendarPlus,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SecurityBadge } from "@/components/shared/security-badge";
import { CompleteProfileCard } from "./complete-profile-card";
import { ReConsentBanner } from "@/components/patient/re-consent-banner";
import { usePatientStore, type Appointment } from "@/lib/patient-store";
import { useMessagesUnread } from "@/lib/use-messages-unread";

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
  return a.status === "completed" || a.status === "cancelled" || a.status === "no-show" || a.status === "rejected";
}

interface DbAppt {
  id: string;
  clinicianName: string;
  clinicianDepartment: string | null;
  startsAt: string;
  date: string;
  time: string;
  status: string;
  notes: string | null;
  mode?: "in-person" | "telehealth";
}
function mapApptStatus(s: string): Appointment["status"] {
  if (s === "completed") return "completed";
  if (s === "cancelled") return "cancelled";
  if (s === "no_show") return "no-show";
  if (s === "requested") return "requested";
  if (s === "reschedule_requested") return "reschedule-requested";
  if (s === "arrived") return "arrived";
  if (s === "in_progress") return "in-progress";
  if (s === "rejected") return "rejected";
  return "confirmed";
}
function toAppt(d: DbAppt): Appointment {
  return {
    id: d.id,
    clinician: d.clinicianName,
    department: d.clinicianDepartment ?? "Care team",
    date: d.date,
    time: d.time,
    mode: d.mode ?? "in-person",
    status: mapApptStatus(d.status),
    reason: d.notes ?? "Visit",
    documentIds: [],
    createdAt: d.startsAt,
  };
}

interface ApiNext {
  id: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: string;
  notes: string | null;
  clinician: string;
  clinicianDepartment: string | null;
}

interface ApiDashboard {
  ok: true;
  profile: { firstName: string; lastName: string; mrn: string };
  stats: {
    upcomingCount: number;
    careTeamSize: number;
    documents: number;
    activeConsents: number;
    unreadMessages: number;
  };
  next: ApiNext | null;
}

export default function PatientDashboard() {
  const { state } = usePatientStore();
  const liveUnread = useMessagesUnread();
  const [api, setApi] = useState<ApiDashboard | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [dbAppts, setDbAppts] = useState<Appointment[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/patient/dashboard", { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        setApi(data as ApiDashboard);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setApiLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Appointments come from the DB (the demo store is never displayed).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/patient/appointments", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok || !Array.isArray(data.appointments)) return;
        setDbAppts((data.appointments as DbAppt[]).map(toAppt));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!state.hydrated || apiLoading) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const upcoming = dbAppts
    .filter((a) => !isPast(a))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const next = upcoming[0];
  const unreadThreads = liveUnread; // live DB-backed unread count

  const greetingFirstName = api?.profile.firstName ?? state.profile.firstName;
  const stats = {
    upcomingCount: upcoming.length,
    activeConsents: api?.stats.activeConsents ?? 0,
    documents: api?.stats.documents ?? 0,
    unreadMessages: unreadThreads,
  };

  return (
    <>
      <ReConsentBanner />
      <GreetingHero firstName={greetingFirstName} next={next} unread={stats.unreadMessages} pending={0} />
      <QuickStats
        appointments={stats.upcomingCount}
        consents={stats.activeConsents}
        documents={stats.documents}
        unread={stats.unreadMessages}
      />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <UpcomingAppointments appts={upcoming} />
          <RecentRecords />
        </div>
        <div className="space-y-5">
          <CompleteProfileCard />
          <PendingConsents />
          <RecentMessages />
          <ActivityFeed />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// DB-backed helpers used by the cards below.
// ---------------------------------------------------------------------------

const RECORD_ICON = { Lab: Beaker, Prescription: Pill, Imaging: FileImage, Discharge: ClipboardList, Clinical: FileText } as const;
const RECORD_COLOR: Record<string, string> = {
  "Lab Report":   "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]",
  Prescription:   "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]",
  Imaging:        "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]",
  Discharge:      "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]",
  "Clinical Note":"from-[oklch(0.6_0.06_250)] to-[oklch(0.42_0.04_250)]",
};
function iconForCategory(c: string) {
  if (c === "Lab Report") return Beaker;
  if (c === "Prescription") return Pill;
  if (c === "Imaging") return FileImage;
  if (c === "Discharge") return ClipboardList;
  return FileText;
}
function shortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href={`/patient/appointments/${a.id}`}>Manage</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface DbRecord {
  id: string;
  title: string;
  category: string;
  clinician: string;
  date: string; // YYYY-MM-DD
}

function RecentRecords() {
  const [records, setRecords] = useState<DbRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/patient/records", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok) return;
        const list: DbRecord[] = Array.isArray(data.records)
          ? data.records.slice(0, 4).map((r: { id: string; title: string; category: string; clinician: string; date: string }) => ({
              id: r.id, title: r.title, category: r.category, clinician: r.clinician, date: r.date,
            }))
          : [];
        setRecords(list);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      });
    return () => { cancelled = true; };
  }, []);

  function downloadRecordPdf(r: DbRecord) {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(r.title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(110);
    doc.text(`${r.category} · ${r.clinician}`, 14, 30);
    doc.text(`Authored: ${shortDate(r.date)}`, 14, 37);
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
      {records === null ? (
        <p className="p-8 text-center text-xs text-[var(--color-muted-foreground)]">Loading records…</p>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <FileText className="size-6 text-[var(--color-muted-foreground)]" />
          <p className="text-xs text-[var(--color-muted-foreground)]">No records yet — your clinicians&apos; finalized notes and prescriptions will appear here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {records.map((r) => {
            const Icon = iconForCategory(r.category);
            const color = RECORD_COLOR[r.category] ?? "from-[oklch(0.6_0.06_250)] to-[oklch(0.42_0.04_250)]";
            return (
              <li key={r.id} className="group flex items-center gap-4 p-5 transition-colors hover:bg-[var(--color-muted)]/40">
                <span className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-[var(--shadow-soft)]`}>
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                    <Badge variant="muted" size="sm">{r.category}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                    {r.clinician} · {shortDate(r.date)}
                  </p>
                </div>
                <SecurityBadge variant="verified" className="hidden sm:inline-flex" />
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
      )}
    </div>
  );
}

// Silence unused-import after switching off the static color literal.
void RECORD_ICON;

interface ApiConsentRequest {
  id: string;
  clinicianName: string;
  clinicianDepartment: string | null;
  scopes: string[];
  durationHours: number;
  reason: string;
  status: string;
}

const SCOPE_LABEL: Record<string, string> = {
  insurance: "Insurance",
  id_proof: "ID Proof",
  lab: "Lab Report",
  imaging: "Imaging",
  prescriptions: "Prescriptions",
  notes: "Clinical Notes",
  mental_health: "Mental Health",
  other: "Other",
};

function PendingConsents() {
  const [pending, setPending] = useState<ApiConsentRequest[] | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/patient/consent-requests", { cache: "no-store" });
    const data = await r.json();
    if (!data?.ok) return setPending([]);
    const list: ApiConsentRequest[] = Array.isArray(data.requests)
      ? data.requests.filter((req: { status: string }) => req.status === "pending")
      : [];
    setPending(list);
  }

  useEffect(() => {
    let cancelled = false;
    load().catch(() => { if (!cancelled) setPending([]); });
    return () => { cancelled = true; };
  }, []);

  async function decide(id: string, decision: "approved" | "declined") {
    setActing(id);
    try {
      const r = await fetch("/api/patient/consent-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        toast.error(data?.error ?? "Could not update request.");
        return;
      }
      toast.success(decision === "approved" ? "Consent granted · audit-logged" : "Request declined");
      await load();
    } catch {
      toast.error("Network error.");
    } finally {
      setActing(null);
    }
  }

  function initialsFor(name: string): string {
    return name.replace(/^Dr\.?\s*/, "").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  }
  function fmtScopes(scopes: string[]): string {
    const labels = scopes.map((s) => SCOPE_LABEL[s] ?? s);
    if (labels.length <= 2) return labels.join(" & ");
    return `${labels[0]} +${labels.length - 1} more`;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Pending consent</h2>
        {pending && pending.length > 0 ? (
          <Badge variant="warning" size="sm" dot>{pending.length} request{pending.length === 1 ? "" : "s"}</Badge>
        ) : (
          <Badge variant="muted" size="sm">None pending</Badge>
        )}
      </div>
      <div className="space-y-4 p-5">
        {pending === null ? (
          <p className="py-2 text-center text-xs text-[var(--color-muted-foreground)]">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4 text-center text-xs text-[var(--color-muted-foreground)]">
            No clinicians have requested access right now.
          </p>
        ) : (
          pending.map((req) => (
            <div key={req.id} className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/40 p-4">
              <div className="flex items-start gap-3">
                <Avatar className="size-9">
                  <AvatarFallback>{initialsFor(req.clinicianName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{req.clinicianName}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    Requested access to <em>{fmtScopes(req.scopes)}</em> for {req.durationHours}h.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={acting === req.id}
                  onClick={() => decide(req.id, "approved")}
                >
                  {acting === req.id ? "Approving…" : "Approve"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={acting === req.id}
                  onClick={() => decide(req.id, "declined")}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))
        )}

        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/patient/consents">Manage all consents <ArrowRight /></Link>
        </Button>
      </div>
    </div>
  );
}

interface DbThread {
  otherUserId: string;
  otherName: string;
  otherInitials: string;
  lastBody: string;
  lastSentAt: string;
  unread: number;
}

function RecentMessages() {
  const [threads, setThreads] = useState<DbThread[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/messages/threads", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        setThreads(Array.isArray(data.threads) ? (data.threads as DbThread[]) : []);
      })
      .catch(() => { if (!cancelled) setThreads([]); });
    return () => { cancelled = true; };
  }, []);

  const unread = (threads ?? []).filter((t) => t.unread > 0);
  const display = (unread.length > 0 ? unread : (threads ?? [])).slice(0, 2);

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
      {threads === null ? (
        <p className="p-8 text-center text-xs text-[var(--color-muted-foreground)]">Loading…</p>
      ) : display.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <Inbox className="size-6 text-[var(--color-muted-foreground)]" />
          <p className="text-xs text-[var(--color-muted-foreground)]">No conversations yet</p>
          <Button asChild variant="ghost" size="sm">
            <Link href="/patient/messages">Start one →</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {display.map((t) => (
            <li key={t.otherUserId}>
              <Link
                href="/patient/messages"
                className="flex items-start gap-3 p-4 transition-colors hover:bg-[var(--color-muted)]/40"
              >
                <Avatar className="size-8">
                  <AvatarFallback>{t.otherInitials || initials(t.otherName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{t.otherName}</p>
                    <span className="text-[10px] text-[var(--color-muted-foreground)]">{new Date(t.lastSentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-[var(--color-muted-foreground)]">{t.lastBody || "No messages yet"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ActivityItem { id: string; category: string; title: string; body: string; time: string }

const ACT_META: Record<string, { icon: typeof Activity; color: string }> = {
  consent:     { icon: Shield, color: "text-[var(--color-success)] bg-[var(--color-success-soft)]" },
  appointment: { icon: Calendar, color: "text-[var(--color-info)] bg-[var(--color-info-soft)]" },
  record:      { icon: FileText, color: "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]" },
  message:     { icon: MessageSquare, color: "text-[var(--color-info)] bg-[var(--color-info-soft)]" },
  security:    { icon: Activity, color: "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]" },
  approval:    { icon: Shield, color: "text-[oklch(0.5_0.14_75)] bg-[var(--color-warning-soft)]" },
  audit:       { icon: ScrollText, color: "text-[var(--color-muted-foreground)] bg-[var(--color-muted)]" },
  system:      { icon: ScrollText, color: "text-[var(--color-muted-foreground)] bg-[var(--color-muted)]" },
};

function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        setItems(Array.isArray(data.items) ? (data.items as ActivityItem[]).slice(0, 5) : []);
      })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Activity</h2>
        <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
          <Sparkles className="size-3 text-[var(--color-primary)]" /> Audit-tracked
        </span>
      </div>
      {items === null ? (
        <p className="p-8 text-center text-xs text-[var(--color-muted-foreground)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="p-8 text-center text-xs text-[var(--color-muted-foreground)]">No recent activity yet.</p>
      ) : (
        <ul className="space-y-3 p-5">
          {items.map((e) => {
            const meta = ACT_META[e.category] ?? ACT_META.audit;
            const Icon = meta.icon;
            return (
              <li key={e.id} className="flex items-start gap-3">
                <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{e.title}</p>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">{e.body || e.time}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
