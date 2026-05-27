"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Save,
  FileSignature,
  Sparkles,
  Type,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Quote,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ActionButton } from "@/components/shared/action-button";
import { cn } from "@/lib/utils";
import { useClinicianStore, type NoteTemplate } from "@/lib/clinician-store";

interface TemplateMeta {
  name: NoteTemplate;
  description: string;
  sectionLabels: { key: "subjective" | "objective" | "assessment" | "plan" | "body"; label: string; placeholder: string; default?: string }[];
}

const TEMPLATES: TemplateMeta[] = [
  {
    name: "SOAP",
    description: "Standard office-visit structure",
    sectionLabels: [
      {
        key: "subjective",
        label: "Subjective",
        placeholder: "Patient's reported history, symptoms, concerns…",
        default: "Patient returns for follow-up. Reports adherence to current regimen.",
      },
      { key: "objective", label: "Objective", placeholder: "Vital signs, physical exam, lab values…" },
      { key: "assessment", label: "Assessment", placeholder: "Diagnoses, differentials, problem list…" },
      {
        key: "plan",
        label: "Plan",
        placeholder: "Medications, follow-up, education, referrals…",
        default: "1. Continue current medications\n2. Repeat labs in 12 weeks\n3. Return visit in 3 months",
      },
    ],
  },
  {
    name: "Progress",
    description: "Brief follow-up encounter",
    sectionLabels: [
      { key: "subjective", label: "Interval history", placeholder: "Changes since last visit, adherence, new events…" },
      { key: "objective", label: "Exam", placeholder: "Focused exam findings…" },
      { key: "plan", label: "Plan", placeholder: "Adjustments to current plan…" },
    ],
  },
  {
    name: "Discharge",
    description: "End-of-admission documentation",
    sectionLabels: [
      { key: "subjective", label: "Course", placeholder: "Hospital course, key interventions…" },
      { key: "assessment", label: "Diagnoses", placeholder: "Principal + secondary diagnoses at discharge…" },
      { key: "body", label: "Medications & follow-up", placeholder: "Discharge meds, follow-up schedule…" },
    ],
  },
  {
    name: "Consult",
    description: "Specialist opinion + recommendation",
    sectionLabels: [
      { key: "subjective", label: "Reason", placeholder: "Referring question or chief concern…" },
      { key: "objective", label: "Findings", placeholder: "Pertinent findings from your evaluation…" },
      { key: "plan", label: "Recommendation", placeholder: "Diagnostic plan, treatment recommendations…" },
    ],
  },
];

type FieldKey = "subjective" | "objective" | "assessment" | "plan" | "body";

interface NoteFields {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  body?: string;
}

export default function NewNotePage() {
  return (
    <Suspense fallback={null}>
      <NewNotePageInner />
    </Suspense>
  );
}

function NewNotePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, addNote, updateNote, finalizeNote } = useClinicianStore();

  const [activeIdx, setActiveIdx] = useState(0);
  const active = TEMPLATES[activeIdx];

  const initialPatient = params.get("patient") ?? state.assignedPatients[0]?.id ?? "";
  const [patientId, setPatientId] = useState(initialPatient);

  const [encounterType, setEncounterType] = useState("Office visit");
  const [encounterDate, setEncounterDate] = useState(new Date().toISOString().slice(0, 10));

  const initialFields: NoteFields = useMemo(() => {
    const out: NoteFields = {};
    for (const s of active.sectionLabels) {
      if (s.default) out[s.key] = s.default;
    }
    return out;
  }, [active]);

  const [fields, setFields] = useState<NoteFields>(initialFields);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setField(key: FieldKey, value: string) {
    setFields((curr) => ({ ...curr, [key]: value }));
  }

  function switchTemplate(idx: number) {
    if (idx === activeIdx) return;
    setActiveIdx(idx);
    const seed: NoteFields = {};
    for (const s of TEMPLATES[idx].sectionLabels) {
      if (s.default) seed[s.key] = s.default;
    }
    setFields(seed);
    toast.info(`Switched to ${TEMPLATES[idx].name} note`);
  }

  function persistDraft(): string | null {
    if (!patientId) {
      toast.warning("Pick a patient first");
      return null;
    }
    setSaving(true);
    let id = draftId;
    if (!id) {
      const note = addNote({
        patientId,
        template: active.name,
        ...fields,
      });
      id = note.id;
      setDraftId(id);
    } else {
      updateNote(id, { template: active.name, ...fields });
    }
    setSaving(false);
    return id;
  }

  function handleSaveDraft() {
    const id = persistDraft();
    if (id) {
      toast.success("Draft saved", { description: `Note ${id.slice(-6)} · audit-logged` });
    }
  }

  function handleFinalize() {
    const id = persistDraft();
    if (!id) return;
    finalizeNote(id);
    toast.success("Note finalized · locked", { description: "Patient notified · audit-logged as record.finalize" });
    router.push("/clinician/notes");
  }

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const patient = state.assignedPatients.find((p) => p.id === patientId);

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/clinician/notes"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Notes
        </Link>
        <span>/</span>
        <span>{draftId ? "Edit draft" : "New clinical note"}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Clinical note</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Save draft to persist · finalize to lock and notify the patient
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={draftId ? "muted" : "outline"} size="sm">{draftId ? "Draft" : "New"} · v1</Badge>
          <Badge variant="default" size="sm">{active.name}</Badge>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving || !patientId}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Save draft
          </Button>
          <ActionButton
            size="sm"
            confirm={{
              title: "Finalize & lock this note?",
              description: "Finalization is irreversible. The record becomes immutable and visible to the patient (subject to consent).",
              confirmLabel: "Finalize & lock",
            }}
            onClick={handleFinalize}
          >
            <FileSignature /> Finalize & lock
          </ActionButton>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {/* Patient + meta */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="patient">Patient</Label>
                <select
                  id="patient"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
                >
                  {state.assignedPatients.length === 0 && <option value="">— No patients assigned —</option>}
                  {state.assignedPatients.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.mrn}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Avatar className="size-10">
                  <AvatarFallback>{patient?.initials ?? "??"}</AvatarFallback>
                </Avatar>
              </div>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="enc">Encounter type</Label>
                <select
                  id="enc"
                  value={encounterType}
                  onChange={(e) => setEncounterType(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
                >
                  <option>Office visit</option>
                  <option>Telehealth</option>
                  <option>Inpatient round</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dt">Encounter date</Label>
                <Input id="dt" type="date" value={encounterDate} onChange={(e) => setEncounterDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Editor toolbar */}
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-muted)]/30 px-3 py-2">
              <select
                className="rounded-md border border-[var(--color-input)] bg-[var(--color-card)] px-2 py-1 text-xs font-medium"
                defaultValue="Body"
              >
                <option>Heading</option>
                <option>Subheading</option>
                <option>Body</option>
              </select>
              <span className="mx-1 h-5 w-px bg-[var(--color-border)]" />
              {[Bold, Italic, List, ListOrdered, Quote, Code].map((Icon, i) => (
                <ActionButton
                  key={i}
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  toastMessage="Formatting applied"
                  toastVariant="info"
                >
                  <Icon />
                </ActionButton>
              ))}
              <span className="mx-1 h-5 w-px bg-[var(--color-border)]" />
              <ActionButton
                variant="ghost"
                size="sm"
                type="button"
                toastMessage="Lab-driven suggestion inserted"
                toastDescription="Based on recent labs"
              >
                <Sparkles /> Suggest from labs
              </ActionButton>
            </div>

            <div key={active.name} className="space-y-5 p-5">
              {active.sectionLabels.map((s, i) => (
                <div key={`${active.name}-${s.key}`} className="animate-[fade-in_0.25s_ease-out]">
                  <div className="flex items-center gap-2">
                    <Type className="size-3.5 text-[var(--color-primary-700)]" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
                      {s.label}
                    </p>
                  </div>
                  <Textarea
                    rows={i === 0 ? 4 : 3}
                    value={fields[s.key] ?? ""}
                    onChange={(e) => setField(s.key, e.target.value)}
                    placeholder={s.placeholder}
                    className="mt-1.5"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {patient && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Patient</p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar className="size-10"><AvatarFallback>{patient.initials}</AvatarFallback></Avatar>
                <div>
                  <p className="text-sm font-semibold">{patient.name}</p>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">{patient.age} · {patient.sex} · {patient.mrn}</p>
                </div>
              </div>
              {patient.allergies && patient.allergies.length > 0 && (
                <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
                  Allergies: <span className="text-[var(--color-danger)] font-medium">{patient.allergies.join(", ")}</span>
                </p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Templates</p>
              <Badge variant="muted" size="sm">{TEMPLATES.length} available</Badge>
            </div>
            <ul className="mt-3 space-y-2">
              {TEMPLATES.map((t, i) => {
                const isActive = i === activeIdx;
                return (
                  <li key={t.name}>
                    <button
                      type="button"
                      onClick={() => switchTemplate(i)}
                      className={cn(
                        "group w-full rounded-lg border p-3 text-left transition-all",
                        isActive
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-50)]/60 shadow-[var(--shadow-soft)]"
                          : "border-[var(--color-border)] hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-muted)]/30 hover:shadow-[var(--shadow-soft)]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-sm font-semibold", isActive && "text-[var(--color-primary-700)]")}>
                          {t.name}
                        </p>
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            <CheckCircle2 className="size-3" /> Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100">
                            Switch →
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{t.description}</p>
                      <p className={cn("mt-1.5 text-[10px] font-medium", isActive ? "text-[var(--color-primary-700)]" : "text-[var(--color-muted-foreground)]")}>
                        {t.sectionLabels.map((s) => s.label).join(" · ")}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Finalization rules
            </p>
            <ul className="mt-3 space-y-2 text-[var(--color-muted-foreground)]">
              <li>• Locked notes are immutable</li>
              <li>• Edits after finalization create new versions</li>
              <li>• Both finalize and version events are audit-logged</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <SecurityBadge variant="encrypted" />
              <SecurityBadge variant="audited" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
