"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Stethoscope,
  Video,
  MapPin,
  Play,
  CheckCheck,
  ClipboardList,
  Plus,
  FileText,
  Pill,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";
import {
  useClinicianStore,
  type AppointmentStatus,
  type ClinicianAppointment,
} from "@/lib/clinician-store";

function fullDate(yyyymmdd: string): string {
  return new Date(yyyymmdd + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_VARIANT: Record<AppointmentStatus, "info" | "warning" | "success" | "muted" | "danger"> = {
  requested: "muted",
  confirmed: "info",
  arrived: "warning",
  "in-progress": "success",
  completed: "success",
  cancelled: "muted",
  "no-show": "danger",
};

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, setAppointmentStatus } = useClinicianStore();

  const appointment = state.hydrated ? state.appointments.find((a) => a.id === id) : undefined;
  const patient = appointment ? state.assignedPatients.find((p) => p.id === appointment.patientId) : undefined;

  const relatedNotes = useMemo(
    () => (appointment ? state.notes.filter((n) => n.appointmentId === appointment.id) : []),
    [appointment, state.notes],
  );
  const relatedRxs = useMemo(
    () => (appointment ? state.prescriptions.filter((r) => r.appointmentId === appointment.id) : []),
    [appointment, state.prescriptions],
  );

  if (!state.hydrated) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading…
      </div>
    );
  }

  if (!appointment) {
    return <NotFound id={id} />;
  }

  const status = appointment.status;
  const closed = status === "completed" || status === "cancelled" || status === "no-show";

  function changeStatus(next: AppointmentStatus, message: string) {
    setAppointmentStatus(appointment!.id, next);
    toast.success(message, {
      description: `${patient?.name ?? "Patient"} · ${appointment!.time} · audit-logged`,
    });
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/clinician/schedule" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Schedule
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{appointment.id}</span>
      </div>

      <PageHeader
        eyebrow="Appointment"
        title={appointment.reason}
        description={`${fullDate(appointment.date)} · ${appointment.time} · ${appointment.durationMinutes} min`}
        actions={
          <>
            {patient && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/clinician/patients/${patient.id}`}>
                  <Stethoscope /> Open patient chart
                </Link>
              </Button>
            )}
            <Badge variant={STATUS_VARIANT[status]} size="sm" dot>{status.replace("-", " ")}</Badge>
          </>
        }
      />

      {/* Patient identity */}
      {patient ? (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] to-[oklch(0.96_0.025_235)] p-4">
          <Avatar className="size-12"><AvatarFallback>{patient.initials}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/clinician/patients/${patient.id}`} className="text-sm font-semibold hover:underline">
                {patient.name}
              </Link>
              <Badge variant="muted" size="sm">{patient.age} · {patient.sex}</Badge>
              <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">{patient.mrn}</span>
              {patient.consentStatus === "active" ? (
                <SecurityBadge variant="consent-bound" />
              ) : (
                <Badge variant="danger" size="sm" dot>Consent revoked</Badge>
              )}
            </div>
            {patient.allergies && patient.allergies.length > 0 && (
              <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
                Allergies: <span className="font-medium text-[var(--color-danger)]">{patient.allergies.join(", ")}</span>
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/40 p-3.5 text-xs">
          <AlertTriangle className="mr-1 inline size-3.5" />
          Patient <code className="font-mono">{appointment.patientId}</code> is not on your panel. Some actions may be limited.
        </div>
      )}

      {/* Encounter details + lifecycle */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <LifecyclePanel appt={appointment} closed={closed} onChange={changeStatus} />

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <Calendar className="size-4" /> Encounter
            </h2>
            <dl className="mt-3 space-y-2 text-xs">
              <Row label="Mode" value={
                <span className="inline-flex items-center gap-1.5">
                  {appointment.mode === "telehealth"
                    ? <><Video className="size-3" /> Telehealth</>
                    : <><MapPin className="size-3" /> In-person</>}
                </span>
              } />
              <Row label="Duration" value={`${appointment.durationMinutes} min`} mono />
              <Row label="Reason" value={appointment.reason} />
              {appointment.startedAt && <Row label="Started" value={dateTimeLabel(appointment.startedAt)} mono />}
              {appointment.completedAt && <Row label="Completed" value={dateTimeLabel(appointment.completedAt)} mono />}
              <Row label="Appointment ID" value={appointment.id} mono />
            </dl>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Audit trail</p>
            <ul className="mt-3 space-y-2 text-[var(--color-muted-foreground)]">
              <li>• Status change events are recorded with actor, timestamp, IP.</li>
              <li>• Notes finalized during this encounter are immutable post-sign.</li>
              <li>• Linked prescriptions inherit the encounter audit context.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Related work */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RelatedBlock
          title="Clinical notes"
          icon={FileText}
          emptyLabel="No notes drafted for this encounter yet."
          createHref={patient ? `/clinician/notes/new?patient=${patient.id}` : "/clinician/notes/new"}
          createLabel="New note"
          items={relatedNotes.map((n) => ({
            id: n.id,
            primary: `${n.template} note · v${n.version}`,
            secondary: n.status === "finalized" && n.finalizedAt
              ? `Finalized ${dateTimeLabel(n.finalizedAt)}`
              : `Drafted ${dateTimeLabel(n.createdAt)}`,
            badge: n.status === "finalized" ? "Finalized" : "Draft",
            badgeVariant: n.status === "finalized" ? "success" : "warning",
            href: `/clinician/notes/new?patient=${appointment.patientId}&note=${n.id}`,
          }))}
        />
        <RelatedBlock
          title="Prescriptions"
          icon={Pill}
          emptyLabel="No prescriptions issued during this encounter."
          createHref={`/clinician/prescriptions/new?patient=${appointment.patientId}&encounter=${appointment.id}`}
          createLabel="New prescription"
          items={relatedRxs.map((r) => ({
            id: r.id,
            primary: `${r.medication || "Untitled draft"}${r.dose ? ` · ${r.dose}` : ""}`,
            secondary: r.frequency || "—",
            badge: r.status === "finalized" ? "Finalized" : "Draft",
            badgeVariant: r.status === "finalized" ? "success" : "warning",
            href: `/clinician/prescriptions/${r.id}`,
          }))}
        />
      </div>
    </>
  );
}

function LifecyclePanel({
  appt,
  closed,
  onChange,
}: {
  appt: ClinicianAppointment;
  closed: boolean;
  onChange: (next: AppointmentStatus, message: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-50)]/40 p-5">
      <h2 className="text-sm font-semibold inline-flex items-center gap-2">
        <Activity className="size-4" /> Encounter lifecycle
      </h2>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        {closed
          ? "This encounter is closed. Status changes are no longer permitted."
          : "Advance the encounter through arrival, consultation, and completion. Each transition is timestamped."}
      </p>

      <ol className="mt-4 space-y-3">
        <Step
          n={1}
          label="Confirmed"
          done={appt.status !== "requested"}
          current={appt.status === "confirmed"}
          time={appt.status === "confirmed" ? "Ready to check in" : undefined}
        />
        <Step
          n={2}
          label="Arrived"
          done={["arrived", "in-progress", "completed"].includes(appt.status)}
          current={appt.status === "arrived"}
          time={appt.status === "arrived" ? "Patient checked in" : undefined}
        />
        <Step
          n={3}
          label="In progress"
          done={["in-progress", "completed"].includes(appt.status)}
          current={appt.status === "in-progress"}
          time={appt.startedAt ? `Started ${dateTimeLabel(appt.startedAt)}` : undefined}
        />
        <Step
          n={4}
          label="Completed"
          done={appt.status === "completed"}
          current={appt.status === "completed"}
          time={appt.completedAt ? `Completed ${dateTimeLabel(appt.completedAt)}` : undefined}
        />
      </ol>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={appt.status === "confirmed" ? "default" : "outline"}
          disabled={appt.status !== "confirmed"}
          onClick={() => onChange("arrived", "Marked arrived")}
        >
          <CheckCheck /> Mark arrived
        </Button>
        <Button
          size="sm"
          variant={appt.status === "arrived" ? "default" : "outline"}
          disabled={appt.status !== "arrived"}
          onClick={() => onChange("in-progress", "Consultation started")}
        >
          <Play /> Start consultation
        </Button>
        <Button
          size="sm"
          variant={appt.status === "in-progress" ? "default" : "outline"}
          disabled={appt.status !== "in-progress"}
          onClick={() => onChange("completed", "Encounter completed")}
        >
          <CheckCheck /> Complete
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
          disabled={closed}
          onClick={() => onChange("no-show", "Marked no-show")}
        >
          No-show
        </Button>
      </div>
    </div>
  );
}

function Step({
  n,
  label,
  done,
  current,
  time,
}: {
  n: number;
  label: string;
  done: boolean;
  current: boolean;
  time?: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          done
            ? "bg-[var(--color-success)] text-[var(--color-success-foreground)]"
            : current
              ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] ring-4 ring-[var(--color-primary)]/15"
              : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
        }`}
      >
        {done ? <CheckCheck className="size-3.5" /> : n}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${current ? "text-[var(--color-primary-700)]" : ""}`}>{label}</p>
        {time && <p className="text-[11px] text-[var(--color-muted-foreground)]">{time}</p>}
      </div>
    </li>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className={`text-right font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

interface RelatedItem {
  id: string;
  primary: string;
  secondary: string;
  badge: string;
  badgeVariant: "success" | "warning";
  href: string;
}

function RelatedBlock({
  title,
  icon: Icon,
  emptyLabel,
  createHref,
  createLabel,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  emptyLabel: string;
  createHref: string;
  createLabel: string;
  items: RelatedItem[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <Icon className="size-4" /> {title}
        </h2>
        <Button asChild size="sm" variant="outline">
          <Link href={createHref}><Plus /> {createLabel}</Link>
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="p-8 text-center text-sm text-[var(--color-muted-foreground)]">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 p-4 hover:bg-[var(--color-muted)]/40">
              <div className="min-w-0 flex-1">
                <Link href={it.href} className="text-sm font-medium hover:underline">{it.primary}</Link>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{it.secondary} · <span className="font-mono">{it.id}</span></p>
              </div>
              <Badge variant={it.badgeVariant} size="sm" dot>{it.badge}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/clinician/schedule" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Schedule
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{id}</span>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
        <ClipboardList className="size-6 text-[var(--color-muted-foreground)]" />
        <p className="text-sm font-medium">Appointment not found</p>
        <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
          No appointment matches <code className="font-mono">{id}</code>. It may have been cancelled or belongs to another clinician.
        </p>
        <Button asChild size="sm">
          <Link href="/clinician/schedule"><Clock /> Back to schedule</Link>
        </Button>
      </div>
    </div>
  );
}
