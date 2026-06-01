"use client";

import { use, useEffect, useState } from "react";
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
  Hourglass,
  ShieldHalf,
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
  hasEffectiveConsent,
  activeApprovedRequest,
  pendingRequest,
  CONSENT_SCOPE_LABEL,
  type AccessRequest,
  type AssignedPatient,
  type AppointmentStatus,
  type ClinicianAppointment,
  type ConsentScope,
} from "@/lib/clinician-store";
import { RequestAccessDialog } from "./request-access-dialog";

function dateLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PatientChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const {
    state,
    setAppointmentStatus,
    toggleConsent,
    uploadDocument,
    reconcileRemoteRequest,
  } = useClinicianStore();

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestInitialScope, setRequestInitialScope] = useState<ConsentScope | undefined>(undefined);
  const [apiPatient, setApiPatient] = useState<AssignedPatient | null>(null);
  const [apiResolved, setApiResolved] = useState<"pending" | "found" | "missing">("pending");

  // DB-backed prescriptions for this patient. Refetched whenever the chart
  // remounts and after every onNew/onFinalize so the list reflects Postgres.
  interface DbRx {
    id: string;
    medication: string;
    dose: string;
    frequency: string;
    duration: string;
    route: string;
    status: "draft" | "finalized";
    createdAt: string;
  }
  const [dbRxs, setDbRxs] = useState<DbRx[]>([]);
  const reloadRxs = async () => {
    const r = await fetch(`/api/clinician/prescriptions?patientId=${id}`, { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    if (!data.ok) return;
    setDbRxs(
      (data.prescriptions as Array<{
        id: string;
        drugName: string;
        strength: string | null;
        frequency: string | null;
        duration: string | null;
        route: string | null;
        status: string;
        createdAt: string;
      }>).map((p) => ({
        id: p.id,
        medication: p.drugName,
        dose: p.strength ?? "",
        frequency: p.frequency ?? "",
        duration: p.duration ?? "",
        route: p.route ?? "",
        status: p.status === "finalized" ? "finalized" : "draft",
        createdAt: p.createdAt,
      })),
    );
  };
  useEffect(() => {
    void reloadRxs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll DB for this clinician's consent-request decisions on this patient.
  // When the patient approves on /patient/consents, the next tick reconciles
  // the local store, flipping the yellow "Awaiting…" banner to the green
  // "Temporary access · expires in …" banner without a manual refresh.
  useEffect(() => {
    let cancelled = false;
    async function pullStatus() {
      try {
        const r = await fetch(`/api/clinician/consent-requests?patientId=${id}`, { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled || !data?.ok || !Array.isArray(data.requests)) return;
        for (const row of data.requests) {
          reconcileRemoteRequest({
            id: row.id,
            patientId: row.patientId,
            scopes: Array.isArray(row.scopes) ? row.scopes : [],
            durationHours: Number(row.durationHours),
            reason: row.reason,
            status: row.status,
            requestedAt: row.requestedAt,
            decidedAt: row.decidedAt,
            expiresAt: row.expiresAt,
          });
        }
      } catch {
        // network blip — try again next tick
      }
    }
    void pullStatus();
    const handle = window.setInterval(pullStatus, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // When the localStorage seed doesn't have this UUID (real DB-backed patient),
  // fetch the patient identity from the API and synthesize a minimal
  // AssignedPatient shape so the rest of the page renders. Clinical lists
  // (notes/Rx/docs) come from the mock store and will be empty for DB patients
  // until those modules are DB-backed too.
  const storeHasPatient = state.assignedPatients.some((p) => p.id === id);
  useEffect(() => {
    if (storeHasPatient || !state.hydrated) return;
    let cancelled = false;
    fetch(`/api/clinician/patients/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || !data.ok) {
          setApiResolved("missing");
          return;
        }
        const p = data.patient;
        setApiPatient({
          id: p.id,
          mrn: p.mrn,
          name: p.name,
          initials: p.initials,
          age: p.age ?? 0,
          sex: (p.sex === "M" ? "M" : p.sex === "F" ? "F" : "Other") as "M" | "F" | "Other",
          email: p.email,
          phone: p.phone ?? "",
          assignedAt: p.startedAt,
          consentScopes: [],
          consentStatus: "active",
          conditions: [],
          allergies: [],
        });
        setApiResolved("found");
      })
      .catch(() => {
        if (!cancelled) setApiResolved("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [id, storeHasPatient, state.hydrated]);

  if (!state.hydrated || (!storeHasPatient && apiResolved === "pending")) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const patient = state.assignedPatients.find((p) => p.id === id) ?? apiPatient;
  if (!patient) return <PatientNotFound id={id} />;

  const myAppointments = state.appointments.filter((a) => a.patientId === patient.id);
  const todayAppointment = myAppointments.find((a) => a.date === new Date().toISOString().slice(0, 10) && a.status !== "completed" && a.status !== "cancelled");
  const myNotes = state.notes.filter((n) => n.patientId === patient.id);
  const myDocs = state.documents.filter((d) => d.patientId === patient.id);

  const showRevokedBanner = patient.consentStatus === "revoked";

  const activeGrant = activeApprovedRequest(state, patient.id);
  const pending = pendingRequest(state, patient.id);

  function openRequestDialog(scope?: ConsentScope) {
    setRequestInitialScope(scope);
    setRequestOpen(true);
  }

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

      {pending && <PendingRequestBanner request={pending} />}

      {activeGrant && (
        <ApprovedAccessBanner request={activeGrant} />
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
          <div className="space-y-3">
            <div className="flex items-center justify-end">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/clinician/patients/${patient.id}/timeline`}>
                  Open full timeline view <ArrowLeft className="rotate-180" />
                </Link>
              </Button>
            </div>
            <Timeline patient={patient} appointments={myAppointments} notes={myNotes} prescriptions={dbRxs.map((p) => ({ id: p.id, medication: p.medication, dose: p.dose, status: p.status, createdAt: p.createdAt }))} />
          </div>
        </TabsContent>
        <TabsContent value="records">
          {hasEffectiveConsent(state, patient.id, "notes") || hasEffectiveConsent(state, patient.id, "lab") ? (
            <div className="space-y-3">
              <div className="flex items-center justify-end">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/clinician/patients/${patient.id}/records`}>
                    Open full records view <ArrowLeft className="rotate-180" />
                  </Link>
                </Button>
              </div>
              <RecordsList notes={myNotes} />
            </div>
          ) : (
            <ConsentDeniedCard
              category="Records"
              onRequestAccess={pending ? undefined : () => openRequestDialog("notes")}
            />
          )}
        </TabsContent>
        <TabsContent value="prescriptions">
          {hasEffectiveConsent(state, patient.id, "prescriptions") ? (
            <Prescriptions
              rxs={dbRxs}
              onNew={async () => {
                const r = await fetch("/api/clinician/prescriptions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ patientId: patient.id }),
                });
                const data = await r.json();
                if (!r.ok || !data.ok) {
                  toast.error(data.error ?? "Could not create draft.");
                  return;
                }
                toast.success("Draft prescription created", { description: "Fill in the details and finalize" });
                await reloadRxs();
                router.push(`/clinician/prescriptions/${data.prescription.id}`);
              }}
              onFinalize={async (rxId) => {
                const r = await fetch(`/api/clinician/prescriptions/${rxId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "finalized" }),
                });
                const data = await r.json();
                if (!r.ok || !data.ok) {
                  toast.error(data.error ?? "Could not finalize.");
                  return;
                }
                toast.success("Prescription finalized", { description: `${patient.name} · audit-logged` });
                await reloadRxs();
              }}
            />
          ) : (
            <ConsentDeniedCard
              category="Prescriptions"
              onRequestAccess={pending ? undefined : () => openRequestDialog("prescriptions")}
            />
          )}
        </TabsContent>
        <TabsContent value="documents">
          {hasEffectiveConsent(state, patient.id, "imaging") || hasEffectiveConsent(state, patient.id, "lab") ? (
            <div className="space-y-3">
              <div className="flex items-center justify-end">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/clinician/patients/${patient.id}/documents`}>
                    Open full documents view <ArrowLeft className="rotate-180" />
                  </Link>
                </Button>
              </div>
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
            </div>
          ) : (
            <ConsentDeniedCard
              category="Documents"
              onRequestAccess={pending ? undefined : () => openRequestDialog("imaging")}
            />
          )}
        </TabsContent>
        <TabsContent value="consents">
          <PatientConsents
            // Card-level "granted" check unifies standing consent with any
            // currently-approved (and not yet expired) access request, so a
            // scope approved via the request flow flips its card to green
            // even before consentScopes is updated.
            isGranted={(scope) => hasEffectiveConsent(state, patient.id, scope)}
            onToggle={(scope) => {
              const granted = hasEffectiveConsent(state, patient.id, scope);
              if (granted) {
                // Demo-only revoke from the clinician side — the real
                // revoke flow is patient-initiated.
                toggleConsent(patient.id, scope);
                toast.info(`${CONSENT_SCOPE_LABEL[scope]} access removed (demo)`);
              } else {
                // Request access: open the existing request-access dialog
                // pre-scoped to the chosen category, mirroring the dialog
                // that opens from the per-tab "Request access" CTA.
                openRequestDialog(scope);
              }
            }}
          />
        </TabsContent>
      </Tabs>

      <RequestAccessDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        patient={patient}
        initialScope={requestInitialScope}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sensitive-access banners
// ---------------------------------------------------------------------------

function relativeMinutesAgo(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1m ago";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? "1h ago" : `${hours}h ago`;
}

function PendingRequestBanner({ request }: { request: AccessRequest }) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/40 px-4 py-3 text-sm">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-card)] text-[var(--color-warning-foreground)] ring-1 ring-[var(--color-warning)]/30">
        <Hourglass className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--color-warning-foreground)]">
          Awaiting patient&apos;s consent decision
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--color-muted-foreground)]">
          Submitted {relativeMinutesAgo(request.requestedAt)} · {request.scopes.length} scope
          {request.scopes.length === 1 ? "" : "s"} · {request.durationHours}h window requested
        </p>
      </div>
    </div>
  );
}

function ApprovedAccessBanner({ request }: { request: AccessRequest }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(handle);
  }, []);

  if (!request.expiresAt) return null;
  const remainingMs = Math.max(0, Date.parse(request.expiresAt) - now);
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/40 px-4 py-3 text-sm">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-card)] text-[var(--color-success)] ring-1 ring-[var(--color-success)]/30">
        <ShieldHalf className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--color-success)]">
          Temporary access · expires in {label}
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--color-muted-foreground)]">
          {request.scopes.map((s) => CONSENT_SCOPE_LABEL[s]).join(", ")} · every view audit-logged
        </p>
      </div>
      <Badge variant="success" size="sm" dot>Approved</Badge>
    </div>
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
        <Button asChild size="sm" variant="ghost">
          <Link href={`/clinician/appointments/${appt.id}`}>Open detail</Link>
        </Button>
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
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
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
                <td className="px-5 py-3">
                  <Link
                    href={`/clinician/prescriptions/${r.id}`}
                    className="font-medium hover:text-[var(--color-primary-700)] hover:underline"
                  >
                    {r.medication || "Untitled draft"}
                  </Link>
                </td>
                <td className="px-5 py-3 font-mono">{r.dose || "—"}</td>
                <td className="px-5 py-3 text-[var(--color-muted-foreground)]">{r.frequency || "—"}</td>
                <td className="px-5 py-3 text-[var(--color-muted-foreground)]">{r.duration || "—"}</td>
                <td className="px-5 py-3 text-right">
                  {r.status === "finalized" ? (
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant="success" size="sm" dot>Finalized</Badge>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/clinician/prescriptions/${r.id}`}>View</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Badge variant="warning" size="sm" dot>Draft</Badge>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/clinician/prescriptions/${r.id}`}>Edit</Link>
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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

function PatientConsents({
  isGranted,
  onToggle,
}: {
  isGranted: (scope: ConsentScope) => boolean;
  onToggle: (scope: ConsentScope) => void;
}) {
  // Document-category-driven scope grid — matches the 6 toggles the patient
  // sees on /patient/consents/grant. Insurance / ID Proof / Lab Report /
  // Imaging / Prescription / Other replaces the previous PHI-access set
  // (Lab Reports / Prescriptions / Clinical Notes / Imaging / Mental Health).
  const all: ConsentScope[] = [
    "insurance",
    "id_proof",
    "lab",
    "imaging",
    "prescriptions",
    "other",
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {all.map((scope) => {
        const granted = isGranted(scope);
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
