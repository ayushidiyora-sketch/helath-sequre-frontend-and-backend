"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pill,
  Save,
  Lock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useClinicianStore, type Prescription } from "@/lib/clinician-store";

const ROUTES = ["Oral", "Topical", "Subcutaneous", "Intramuscular", "Intravenous", "Inhaled", "Sublingual", "Ophthalmic", "Otic", "Rectal"];

const FREQUENCIES = [
  "Once daily",
  "Once nightly",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "Every 4 hours",
  "Every 6 hours",
  "Every 8 hours",
  "Every 12 hours",
  "As needed (PRN)",
  "Weekly",
];

export default function PrescriptionFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rxId } = use(params);
  const router = useRouter();
  const { state, updatePrescription, finalizePrescription } = useClinicianStore();

  if (!state.hydrated) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading…
      </div>
    );
  }

  const rx = state.prescriptions.find((p) => p.id === rxId);
  if (!rx) {
    return (
      <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-6">
        <p className="text-sm font-medium">Prescription not found.</p>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          It may have been deleted. <Link href="/clinician/patients" className="underline">Back to patients</Link>.
        </p>
      </div>
    );
  }

  const patient = state.assignedPatients.find((p) => p.id === rx.patientId);
  const locked = rx.status === "finalized";

  return (
    <PrescriptionForm
      rx={rx}
      patient={patient}
      locked={locked}
      onSaveDraft={(patch) => {
        updatePrescription(rx.id, patch);
        toast.success("Draft saved", { description: "Audit-logged · not yet active until finalized" });
      }}
      onFinalize={(patch) => {
        updatePrescription(rx.id, patch);
        finalizePrescription(rx.id);
        toast.success("Prescription finalized", {
          description: `${patient?.name ?? "Patient"} · sent to pharmacy · audit-logged`,
        });
        if (patient) router.push(`/clinician/patients/${patient.id}?tab=prescriptions`);
      }}
    />
  );
}

interface FormPatch {
  medication: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  refills?: string;
  instructions?: string;
}

function PrescriptionForm({
  rx,
  patient,
  locked,
  onSaveDraft,
  onFinalize,
}: {
  rx: Prescription;
  patient: { id: string; name: string; initials: string; mrn: string; age: number; sex: string; allergies?: string[] } | undefined;
  locked: boolean;
  onSaveDraft: (patch: FormPatch) => void;
  onFinalize: (patch: FormPatch) => void;
}) {
  const isNewDraft = rx.medication === "New prescription";
  const [form, setForm] = useState<FormPatch>({
    medication: isNewDraft ? "" : rx.medication,
    dose: rx.dose,
    frequency: rx.frequency,
    duration: rx.duration,
    route: rx.route,
    refills: rx.refills ?? "",
    instructions: rx.instructions ?? "",
  });

  // Re-sync from store if rx changes (e.g., parallel edit).
  useEffect(() => {
    setForm({
      medication: rx.medication === "New prescription" ? "" : rx.medication,
      dose: rx.dose,
      frequency: rx.frequency,
      duration: rx.duration,
      route: rx.route,
      refills: rx.refills ?? "",
      instructions: rx.instructions ?? "",
    });
  }, [rx.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof FormPatch>(key: K, value: FormPatch[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canFinalize =
    form.medication.trim().length > 0 &&
    form.dose.trim().length > 0 &&
    form.frequency.trim().length > 0 &&
    form.duration.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    if (!canFinalize) {
      onSaveDraft(form);
      return;
    }
    onFinalize(form);
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href={patient ? `/clinician/patients/${patient.id}?tab=prescriptions` : "/clinician/patients"}
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> {patient?.name ?? "Patients"}
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">
          {locked ? "View prescription" : "New prescription"}
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {locked ? "Prescription" : "Compose prescription"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {locked
            ? "This prescription is finalized and locked. Audit-logged."
            : "Save draft to keep working, or finalize to lock and dispense."}
        </p>
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/30 px-4 py-2.5 text-xs text-[var(--color-foreground)]">
          <Lock className="size-3.5 text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]" />
          Locked · finalized {rx.finalizedAt ? new Date(rx.finalizedAt).toLocaleString() : ""}
        </div>
      )}

      <form className="max-w-5xl" onSubmit={handleSubmit}>
        <div className="grid gap-5 lg:grid-cols-[1.85fr_1fr]">
          <div className="space-y-5">
            {/* Drug + Dose */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <Pill className="size-4" /> Medication
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="medication">Drug name</Label>
                  <Input
                    id="medication"
                    value={form.medication}
                    onChange={(e) => set("medication", e.target.value)}
                    placeholder="e.g. Atorvastatin"
                    disabled={locked}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dose">Strength / dose</Label>
                  <Input
                    id="dose"
                    value={form.dose}
                    onChange={(e) => set("dose", e.target.value)}
                    placeholder="e.g. 20 mg"
                    disabled={locked}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="route">Route</Label>
                  <select
                    id="route"
                    value={form.route}
                    onChange={(e) => set("route", e.target.value)}
                    disabled={locked}
                    className="h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {ROUTES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <h2 className="text-sm font-semibold">Schedule</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="frequency">Frequency</Label>
                  <select
                    id="frequency"
                    value={form.frequency}
                    onChange={(e) => set("frequency", e.target.value)}
                    disabled={locked}
                    className="h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="">Select…</option>
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="duration">Duration</Label>
                  <Input
                    id="duration"
                    value={form.duration}
                    onChange={(e) => set("duration", e.target.value)}
                    placeholder="e.g. 90 days"
                    disabled={locked}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="refills">Refills</Label>
                  <Input
                    id="refills"
                    type="number"
                    min={0}
                    max={11}
                    value={form.refills}
                    onChange={(e) => set("refills", e.target.value)}
                    placeholder="0"
                    disabled={locked}
                  />
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <h2 className="text-sm font-semibold">Patient instructions</h2>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Surfaced on the patient&apos;s prescription page and printed on the label.
              </p>
              <Textarea
                className="mt-3"
                rows={4}
                value={form.instructions}
                onChange={(e) => set("instructions", e.target.value)}
                placeholder="e.g. Take at bedtime. Avoid grapefruit juice. Report any unexplained muscle pain or weakness."
                disabled={locked}
              />
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {patient && (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Patient
                </p>
                <div className="mt-3 flex items-start gap-3">
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback>{patient.initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{patient.name}</p>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">
                      {patient.age} · {patient.sex} · <span className="font-mono">{patient.mrn}</span>
                    </p>
                  </div>
                </div>
                {patient.allergies && patient.allergies.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-2.5 text-xs">
                    <p className="inline-flex items-center gap-1 font-semibold text-[var(--color-danger)]">
                      <AlertTriangle className="size-3.5" /> Allergies
                    </p>
                    <p className="mt-1 text-[var(--color-foreground)]">{patient.allergies.join(", ")}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-[var(--color-muted-foreground)]">
                    No known allergies on file.
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Status
              </p>
              <div className="mt-2">
                {locked ? (
                  <Badge variant="success" size="sm" dot>Finalized</Badge>
                ) : (
                  <Badge variant="warning" size="sm" dot>Draft</Badge>
                )}
              </div>

              {!locked && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => onSaveDraft(form)}
                  >
                    <Save /> Save draft
                  </Button>
                  <Button type="submit" size="sm" className="mt-2 w-full" disabled={!canFinalize}>
                    <Lock /> Finalize &amp; lock
                  </Button>
                  {!canFinalize && (
                    <p className="mt-2 text-[10px] text-[var(--color-muted-foreground)]">
                      Drug, dose, frequency, and duration required before finalizing.
                    </p>
                  )}
                </>
              )}

              <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                <ShieldCheck className="size-3.5" /> All prescription edits are audit-logged
              </p>
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}
