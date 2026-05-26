"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Stethoscope,
  Calendar,
  Phone,
  Mail,
  Beaker,
  Pill,
  FileImage,
  FileText,
  MessageSquare,
  Plus,
  ScrollText,
  Activity,
  ShieldCheck,
  AlertTriangle,
  ClipboardList,
  Clock,
  Play,
  CheckCheck,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ConsentDeniedCard } from "@/components/shared/consent-denied-card";
import {
  useClinicianStore,
  patientHasConsent,
  CONSENT_SCOPE_LABEL,
  type AssignedPatient,
  type AppointmentStatus,
  type ClinicianAppointment,
  type ConsentScope,
} from "@/lib/clinician-store";

function dateLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PatientChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { state, setAppointmentStatus, addPrescription, finalizePrescription, toggleConsent, uploadDocument } = useClinicianStore();

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const patient = state.assignedPatients.find((p) => p.id === id);
  if (!patient) return <PatientNotFound id={id} />;

  const myAppointments = state.appointments.filter((a) => a.patientId === patient.id);
  const todayAppointment = myAppointments.find((a) => a.date === new Date().toISOString().slice(0, 10) && a.status !== "completed" && a.status !== "cancelled");
  const myNotes = state.notes.filter((n) => n.patientId === patient.id);
  const myRxs = state.prescriptions.filter((p) => p.patientId === patient.id);
  const myDocs = state.documents.filter((d) => d.patientId === patient.id);

  const showRevokedBanner = patient.consentStatus === "revoked";

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/clinician/patients" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Patient panel
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{patient.mrn}</span>
      </div>

      {/* Patient banner */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] to-[oklch(0.96_0.025_235)] p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="size-16"><AvatarFallback>{patient.initials}</AvatarFallback></Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{patient.name}</h1>
              <Badge variant="muted" size="sm">{patient.age} · {patient.sex}</Badge>
              {patient.consentStatus === "active" ? (
                <SecurityBadge variant="consent-bound" />
              ) : (
                <Badge variant="danger" size="sm" dot>Consent revoked</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              MRN <span className="font-mono">{patient.mrn}</span>
              {patient.allergies && patient.allergies.length > 0 && (
                <>
                  {" · "}Allergies: <span className="text-[var(--color-danger)] font-medium">{patient.allergies.join(", ")}</span>
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
              <span className="inline-flex items-center gap-1"><Phone className="size-3.5" /> {patient.phone}</span>
              <span className="inline-flex items-center gap-1"><Mail className="size-3.5" /> {patient.email}</span>
              <span className="inline-flex items-center gap-1"><Stethoscope className="size-3.5" /> Assigned {dateTimeLabel(patient.assignedAt)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/clinician/notes/new?patient=${patient.id}`}><Plus /> SOAP note</Link>
            </Button>
            <Button asChild variant="outline" size="sm"><Link href="/clinician/messages"><MessageSquare /> Message</Link></Button>
          </div>
        </div>

        {showRevokedBanner && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>This patient has revoked consent. Most tabs are unavailable until they re-grant access.</span>
          </div>
        )}
      </div>

      {/* Today's encounter — lifecycle controls */}
      {todayAppointment && (
        <EncounterCard
          appt={todayAppointment}
          onStatus={(status) => {
            setAppointmentStatus(todayAppointment.id, status);
            toast.success(`Marked ${status.replace("-", " ")}`, { description: `${patient.name} · ${todayAppointment.time}` });
          }}
        />
      )}

      <Tabs defaultValue="timeline">
        <TabsList className="flex-wrap">
          <TabsTrigger value="timeline"><Activity /> Timeline</TabsTrigger>
          <TabsTrigger value="records"><FileText /> Records</TabsTrigger>
          <TabsTrigger value="prescriptions"><Pill /> Prescriptions</TabsTrigger>
          <TabsTrigger value="documents"><FileImage /> Documents</TabsTrigger>
          <TabsTrigger value="consents"><ShieldCheck /> Consents</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Timeline patient={patient} appointments={myAppointments} notes={myNotes} prescriptions={myRxs} />
        </TabsContent>
        <TabsContent value="records">
          {patientHasConsent(patient, "notes") || patientHasConsent(patient, "lab") ? (
            <RecordsList notes={myNotes} />
          ) : (
            <ConsentDeniedCard category="Records" />
          )}
        </TabsContent>
        <TabsContent value="prescriptions">
          {patientHasConsent(patient, "prescriptions") ? (
            <Prescriptions
              rxs={myRxs}
              onNew={() => {
                const rx = addPrescription({
                  patientId: patient.id,
                  medication: "New prescription",
                  dose: "",
                  frequency: "",
                  duration: "",
                  route: "Oral",
                });
                toast.success("Draft prescription created", { description: "Edit details, then finalize" });
                router.push(`/clinician/notes/new?patient=${patient.id}&rx=${rx.id}`);
              }}
              onFinalize={(rxId) => {
                finalizePrescription(rxId);
                toast.success("Prescription finalized", { description: `${patient.name} · audit-logged` });
              }}
            />
          ) : (
            <ConsentDeniedCard category="Prescriptions" />
          )}
        </TabsContent>
        <TabsContent value="documents">
          {patientHasConsent(patient, "imaging") || patientHasConsent(patient, "lab") ? (
            <DocumentsList
              docs={myDocs}
              onUpload={(file, category) => {
                uploadDocument({
                  patientId: patient.id,
                  name: file.name,
                  category,
                  sizeBytes: file.size,
                  uploaderName: "Dr. Mehta",
                });
                toast.success("Document uploaded", { description: `${file.name} · scanned · clean` });
              }}
            />
          ) : (
            <ConsentDeniedCard category="Documents" />
          )}
        </TabsContent>
        <TabsContent value="consents">
          <PatientConsents patient={patient} onToggle={(scope) => {
            toggleConsent(patient.id, scope);
            toast.info(`${CONSENT_SCOPE_LABEL[scope]} consent ${patient.consentScopes.includes(scope) ? "removed" : "added"} (demo)`);
          }} />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ---------------------------------------------------------------------------
// Encounter lifecycle card
// ---------------------------------------------------------------------------

function EncounterCard({ appt, onStatus }: { appt: ClinicianAppointment; onStatus: (s: AppointmentStatus) => void }) {
  return (
    <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-50)]/40 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-card)] text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary)]/30">
          <Clock className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Today&apos;s encounter · {appt.time} · {appt.durationMinutes} min</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">{appt.reason} · {appt.mode === "telehealth" ? "Telehealth" : "In-person"}</p>
        </div>
        <Badge variant={appt.status === "confirmed" ? "info" : appt.status === "arrived" ? "warning" : appt.status === "in-progress" ? "success" : "muted"} size="sm" dot>
          {appt.status.replace("-", " ")}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant={appt.status === "confirmed" ? "default" : "outline"}
          size="sm"
          disabled={appt.status !== "confirmed"}
          onClick={() => onStatus("arrived")}
        >
          <CheckCheck /> Mark arrived
        </Button>
        <Button
          variant={appt.status === "arrived" ? "default" : "outline"}
          size="sm"
          disabled={appt.status !== "arrived"}
          onClick={() => onStatus("in-progress")}
        >
          <Play /> Start consultation
        </Button>
        <Button
          variant={appt.status === "in-progress" ? "default" : "outline"}
          size="sm"
          disabled={appt.status !== "in-progress"}
          onClick={() => onStatus("completed")}
        >
          <CheckCheck /> Complete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
          onClick={() => onStatus("no-show")}
          disabled={appt.status === "completed" || appt.status === "cancelled"}
        >
          No-show
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

function Timeline({
  patient,
  appointments,
  notes,
  prescriptions,
}: {
  patient: AssignedPatient;
  appointments: ClinicianAppointment[];
  notes: { id: string; template: string; status: string; createdAt: string; finalizedAt?: string }[];
  prescriptions: { id: string; medication: string; dose: string; status: string; createdAt: string }[];
}) {
  type Event = { icon: typeof Beaker; t: string; sub: string; at: string; color: string };
  const events: Event[] = [];

  events.push({
    icon: ScrollText,
    t: "Patient assigned to your panel",
    sub: "By Org Admin",
    at: patient.assignedAt,
    color: "text-[var(--color-muted-foreground)] bg-[var(--color-muted)]",
  });
  for (const a of appointments) {
    events.push({
      icon: Calendar,
      t: `${a.status === "completed" ? "Completed" : a.status === "cancelled" ? "Cancelled" : "Scheduled"}: ${a.reason}`,
      sub: `${dateLabel(a.date)} · ${a.time}`,
      at: a.completedAt ?? a.startedAt ?? `${a.date}T${a.time}`,
      color: a.status === "completed" ? "text-[var(--color-success)] bg-[var(--color-success-soft)]" : "text-[var(--color-info)] bg-[var(--color-info-soft)]",
    });
  }
  for (const n of notes) {
    events.push({
      icon: FileText,
      t: `${n.template} note ${n.status === "finalized" ? "finalized" : "drafted"}`,
      sub: `By you`,
      at: n.finalizedAt ?? n.createdAt,
      color: n.status === "finalized" ? "text-[var(--color-success)] bg-[var(--color-success-soft)]" : "text-[var(--color-warning)] bg-[var(--color-warning-soft)]",
    });
  }
  for (const p of prescriptions) {
    events.push({
      icon: Pill,
      t: `${p.medication} ${p.dose} ${p.status === "finalized" ? "prescribed" : "drafted"}`,
      sub: "By you",
      at: p.createdAt,
      color: "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]",
    });
  }

  events.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <h2 className="text-sm font-semibold">Clinical timeline</h2>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">No activity yet.</p>
      ) : (
        <ol className="mt-4 space-y-3.5">
          {events.map((e, i) => {
            const Icon = e.icon;
            return (
              <li key={i} className="flex items-start gap-3">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${e.color}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{e.t}</p>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">{e.sub} · {dateTimeLabel(e.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Records list
// ---------------------------------------------------------------------------

function RecordsList({ notes }: { notes: { id: string; template: string; status: string; createdAt: string; finalizedAt?: string }[] }) {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
        <FileText className="size-6 text-[var(--color-muted-foreground)]" />
        <p className="text-sm font-medium">No notes for this patient yet</p>
        <Button asChild size="sm" className="mt-1">
          <Link href="/clinician/notes/new"><Plus /> Create first note</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <ul className="divide-y divide-[var(--color-border)]">
        {notes.map((n) => (
          <li key={n.id} className="flex items-center gap-4 p-5 hover:bg-[var(--color-muted)]/40">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
              <FileText className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{n.template} note</p>
                {n.status === "finalized" ? (
                  <Badge variant="success" size="sm" dot>Finalized</Badge>
                ) : (
                  <Badge variant="warning" size="sm" dot>Draft</Badge>
                )}
              </div>
              <p className="text-[11px] text-[var(--color-muted-foreground)]">
                {n.status === "finalized" && n.finalizedAt
                  ? `Finalized ${dateTimeLabel(n.finalizedAt)}`
                  : `Drafted ${dateTimeLabel(n.createdAt)}`}
                {" · "}<span className="font-mono">{n.id}</span>
              </p>
            </div>
            <SecurityBadge variant="encrypted" className="hidden sm:inline-flex" />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prescriptions
// ---------------------------------------------------------------------------

function Prescriptions({
  rxs,
  onNew,
  onFinalize,
}: {
  rxs: { id: string; medication: string; dose: string; frequency: string; duration: string; status: string; createdAt: string }[];
  onNew: () => void;
  onFinalize: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Prescriptions</h2>
        <Button size="sm" onClick={onNew}>
          <Plus /> New prescription
        </Button>
      </div>
      {rxs.length === 0 ? (
        <p className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">No prescriptions for this patient.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <th className="px-5 py-2.5">Drug</th>
              <th className="px-5 py-2.5">Dose</th>
              <th className="px-5 py-2.5">Frequency</th>
              <th className="px-5 py-2.5">Duration</th>
              <th className="px-5 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rxs.map((r) => (
              <tr key={r.id} className="hover:bg-[var(--color-muted)]/30">
                <td className="px-5 py-3 font-medium">{r.medication || "—"}</td>
                <td className="px-5 py-3 font-mono">{r.dose || "—"}</td>
                <td className="px-5 py-3 text-[var(--color-muted-foreground)]">{r.frequency || "—"}</td>
                <td className="px-5 py-3 text-[var(--color-muted-foreground)]">{r.duration || "—"}</td>
                <td className="px-5 py-3 text-right">
                  {r.status === "finalized" ? (
                    <Badge variant="success" size="sm" dot>Finalized</Badge>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Badge variant="warning" size="sm" dot>Draft</Badge>
                      <Button size="sm" variant="ghost" onClick={() => onFinalize(r.id)}>Finalize</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents (upload + list)
// ---------------------------------------------------------------------------

function DocumentsList({
  docs,
  onUpload,
}: {
  docs: { id: string; name: string; category: string; sizeBytes: number; uploadedAt: string; uploaderName: string }[];
  onUpload: (f: File, category: "Lab Report" | "Imaging" | "Discharge" | "Other") => void;
}) {
  function pickFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.jpg,.jpeg,.png,.dcm,.doc,.docx";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const cat = /ecg|x-?ray|mri|scan|imag/i.test(f.name)
        ? "Imaging"
        : /lab|panel|blood/i.test(f.name)
          ? "Lab Report"
          : /discharge/i.test(f.name)
            ? "Discharge"
            : "Other";
      onUpload(f, cat as "Lab Report" | "Imaging" | "Discharge" | "Other");
    };
    input.click();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Documents</h2>
        <Button size="sm" onClick={pickFile}>
          <Upload /> Upload document
        </Button>
      </div>
      {docs.length === 0 ? (
        <p className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">No documents uploaded for this patient yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-4 p-5 hover:bg-[var(--color-muted)]/40">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                <FileImage className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{d.name}</p>
                  <Badge variant="muted" size="sm">{d.category}</Badge>
                </div>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">
                  {(d.sizeBytes / 1024).toFixed(0)} KB · uploaded {dateTimeLabel(d.uploadedAt)} by {d.uploaderName}
                </p>
              </div>
              <SecurityBadge variant="encrypted" className="hidden sm:inline-flex" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consents tab
// ---------------------------------------------------------------------------

function PatientConsents({ patient, onToggle }: { patient: AssignedPatient; onToggle: (scope: ConsentScope) => void }) {
  const all: ConsentScope[] = ["lab", "prescriptions", "notes", "imaging", "mental_health"];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {all.map((scope) => {
        const granted = patient.consentScopes.includes(scope);
        return (
          <div
            key={scope}
            className={`rounded-2xl border p-5 ${
              granted
                ? "border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/30"
                : "border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30"
            }`}
          >
            {granted ? (
              <Badge variant="success" size="sm" dot>Active</Badge>
            ) : (
              <Badge variant="danger" size="sm" dot>No access</Badge>
            )}
            <p className="mt-2 text-sm font-semibold">{CONSENT_SCOPE_LABEL[scope]}</p>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              {granted
                ? `Patient granted access`
                : `Patient has not granted access`}
            </p>
            <Button
              size="sm"
              variant={granted ? "ghost" : "outline"}
              className="mt-3"
              onClick={() => onToggle(scope)}
            >
              {granted ? "Simulate revoke" : "Request access"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

function PatientNotFound({ id }: { id: string }) {
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
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
          <ClipboardList className="size-5" />
        </div>
        <p className="text-sm font-medium">Patient not on your panel</p>
        <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
          You don&apos;t have an assignment for <code className="font-mono">{id}</code>. Request assignment from your Org Admin.
        </p>
        <Button asChild size="sm">
          <Link href="/clinician/patients">Back to panel</Link>
        </Button>
      </div>
    </div>
  );
}

// Loader2 referenced for future use; explicit keep
void Loader2;
