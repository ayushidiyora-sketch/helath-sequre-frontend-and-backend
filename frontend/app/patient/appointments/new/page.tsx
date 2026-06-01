"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Search,
  MapPin,
  Video,
  Stethoscope,
  Sparkles,
  Calendar as CalIcon,
  Award,
  FileText,
  Paperclip,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SecurityBadge } from "@/components/shared/security-badge";
import { cn } from "@/lib/utils";
import { usePatientStore, type DocumentCategory } from "@/lib/patient-store";

/** "Mon, May 25" → "2026-05-25" (assumes current year if month/day already past). */
function slotDayToIso(label: string): string {
  const parsed = new Date(`${label}, ${new Date().getFullYear()}`);
  if (isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  if (parsed.getTime() < Date.now() - 86_400_000) parsed.setFullYear(parsed.getFullYear() + 1);
  return parsed.toISOString().slice(0, 10);
}

function categoryFromName(name: string): DocumentCategory {
  const lower = name.toLowerCase();
  if (/insur/.test(lower)) return "Insurance";
  if (/ecg|x-?ray|mri|scan|imaging/.test(lower)) return "Imaging";
  if (/prescription|rx/.test(lower)) return "Prescription";
  if (/aadhaar|passport|id|license/.test(lower)) return "ID Proof";
  if (/lab|report|panel|blood/.test(lower)) return "Lab Report";
  return "Other";
}

type Clinician = {
  id: string;
  name: string;
  initials: string;
  designation: string | null;
  department: string | null;
  workLocation: string | null;
  profilePhotoUrl: string | null;
  experienceYears: number;
  tenantName: string | null;
  isAssigned: boolean;
  /** Derived for display: "office" | "telehealth" based on workLocation hints. */
  mode: "office" | "telehealth";
  /** Friendly location label for the row. */
  location: string;
  /** Specialty label = designation || department || "Care team". */
  specialty: string;
};

function deriveMode(workLocation: string | null): "office" | "telehealth" {
  if (!workLocation) return "office";
  return /tele|video|virtual|remote/i.test(workLocation) ? "telehealth" : "office";
}

type SlotDay = { day: string; times: string[]; slotMinutes: number };

type BookingDocument = { name: string; size: string; sizeBytes: number };
type BookingState = {
  clinicianId: string | null;
  slotDay: string | null;
  slotTime: string | null;
  reason: string;
  notes: string;
  documents: BookingDocument[];
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STEPS = [
  { num: 1, name: "Clinician", field: "clinician" },
  { num: 2, name: "Slot", field: "slot" },
  { num: 3, name: "Reason", field: "reason" },
  { num: 4, name: "Review", field: "review" },
];

export default function NewAppointmentPage() {
  const router = useRouter();
  const { addAppointment, addDocument, addNotification } = usePatientStore();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<BookingState>({
    clinicianId: null,
    documents: [],
    slotDay: null,
    slotTime: null,
    reason: "",
    notes: "",
  });
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [cliniciansLoading, setCliniciansLoading] = useState(true);
  const [cliniciansError, setCliniciansError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/patient/clinicians", { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json();
        if (cancelled) return;
        if (!r.ok || !json.ok) {
          setCliniciansError(json.error ?? `HTTP ${r.status}`);
          return;
        }
        type ApiRow = {
          id: string;
          name: string;
          initials: string;
          designation: string | null;
          department: string | null;
          workLocation: string | null;
          profilePhotoUrl: string | null;
          experienceYears: number;
          tenantName: string | null;
          isAssigned: boolean;
        };
        const rows: Clinician[] = (json.clinicians as ApiRow[]).map((c) => {
          const mode = deriveMode(c.workLocation);
          return {
            id: c.id,
            name: c.name,
            initials: c.initials,
            designation: c.designation,
            department: c.department,
            workLocation: c.workLocation,
            profilePhotoUrl: c.profilePhotoUrl,
            experienceYears: c.experienceYears,
            tenantName: c.tenantName,
            isAssigned: c.isAssigned,
            mode,
            location: c.workLocation ?? (mode === "telehealth" ? "Video link" : "Clinic"),
            specialty: c.designation ?? c.department ?? "Care team",
          };
        });
        setClinicians(rows);
      })
      .catch(() => {
        if (!cancelled) setCliniciansError("Network error — could not load clinicians.");
      })
      .finally(() => {
        if (!cancelled) setCliniciansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clinician = clinicians.find((c) => c.id === data.clinicianId) ?? null;

  // Slots come ONLY from the chosen clinician's saved scheduleTemplate (set
  // via Clinician → Schedule → Add availability). No synthetic fallback —
  // when the clinician hasn't published availability the page shows a clear
  // empty state instead of fabricating times that don't match the clinician's
  // calendar (which is exactly what made the booking grid look uniformly
  // 30-min for clinicians who hadn't saved anything).
  const [slots, setSlots] = useState<SlotDay[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [hasTemplate, setHasTemplate] = useState<boolean>(false);
  useEffect(() => {
    if (!data.clinicianId) {
      setSlots([]);
      setHasTemplate(false);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    fetch(`/api/patient/clinicians/${data.clinicianId}/slots`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (cancelled) return;
        if (res?.ok && Array.isArray(res.slots)) {
          setSlots(res.slots);
          setHasTemplate(Boolean(res.hasTemplate));
        } else {
          setSlots([]);
          setHasTemplate(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setHasTemplate(false);
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data.clinicianId]);

  const canContinue =
    step === 1
      ? !!data.clinicianId
      : step === 2
        ? !!data.slotDay && !!data.slotTime
        : step === 3
          ? data.reason.trim().length > 0
          : true;

  const next = () => {
    if (!canContinue) {
      toast.warning("Please complete this step before continuing");
      return;
    }
    if (step < 4) setStep(step + 1);
  };
  const back = () => {
    if (step > 1) setStep(step - 1);
    else router.push("/patient/appointments");
  };

  const [confirming, setConfirming] = useState(false);
  const confirm = async () => {
    if (!clinician || !data.slotDay || !data.slotTime || confirming) return;
    setConfirming(true);
    // Upload any attachments first so the appointment can reference their ids.
    const documentIds = data.documents.map((d) => {
      const doc = addDocument({
        name: d.name,
        category: categoryFromName(d.name),
        sizeBytes: d.sizeBytes,
      });
      return doc.id;
    });
    const date = slotDayToIso(data.slotDay);
    const durationMinutes =
      slots.find((s) => s.day === data.slotDay)?.slotMinutes ?? 15;
    try {
      // Persist to Postgres via POST /api/patient/appointments. The DB row is
      // what the clinician's Schedule Day/Week tabs read — the local store
      // mirror keeps the patient-side /patient/appointments listing populated
      // without a refetch.
      const r = await fetch("/api/patient/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicianId: clinician.id,
          date,
          time: data.slotTime,
          durationMinutes,
          mode: clinician.mode === "office" ? "in-person" : "telehealth",
          reason: data.reason,
        }),
      });
      const body = await r.json();
      if (!r.ok || !body.ok) {
        toast.error(body.error ?? "Could not book appointment.");
        return;
      }
      // Mirror to the local store so /patient/appointments shows the booking
      // immediately without an extra round-trip.
      const apt = addAppointment({
        clinician: clinician.name,
        department: clinician.specialty,
        date,
        time: data.slotTime,
        mode: clinician.mode === "office" ? "in-person" : "telehealth",
        reason: data.reason,
        documentIds,
      });
      addNotification({
        title: "Appointment booked",
        body: `${clinician.name} · ${data.slotDay} at ${data.slotTime}`,
        type: "appointment",
        href: `/patient/appointments/${apt.id}`,
      });
      toast.success("Appointment booked · audit-logged", {
        description: `${clinician.name} · ${data.slotDay} · ${data.slotTime} · reminders scheduled at T-24h and T-1h`,
      });
      setTimeout(() => router.push("/patient/appointments"), 600);
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/patient/appointments"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Appointments
        </Link>
        <span>/</span>
        <span>Book new</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Book an appointment</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Pick a clinician, choose a slot, and tell us briefly why you&apos;re visiting.
        </p>
      </div>

      {/* Stepper */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <ol className="flex items-center gap-2 sm:gap-4">
          {STEPS.map((s, i) => {
            const done = step > s.num;
            const active = step === s.num;
            return (
              <li key={s.num} className="flex flex-1 items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (s.num < step) setStep(s.num);
                  }}
                  disabled={s.num > step}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
                    done && "bg-[var(--color-success)] text-white hover:bg-[oklch(0.6_0.14_158)]",
                    active && "bg-[var(--color-primary)] text-white ring-4 ring-[var(--color-primary)]/15",
                    !done && !active &&
                      "border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                  aria-label={`Step ${s.num}: ${s.name}`}
                >
                  {done ? <CheckCircle2 className="size-4" /> : s.num}
                </button>
                <div className="hidden sm:block">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    Step {s.num}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      active && "text-[var(--color-primary-700)]",
                      done && "text-[var(--color-foreground)]"
                    )}
                  >
                    {s.name}
                  </p>
                </div>
                {i < STEPS.length - 1 && (
                  <span
                    className={cn(
                      "ml-auto hidden h-px flex-1 transition-colors sm:block",
                      done ? "bg-[var(--color-success)]" : "bg-[var(--color-border)]"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {step === 1 && (
            <ClinicianStep
              data={data}
              setData={setData}
              clinicians={clinicians}
              loading={cliniciansLoading}
              error={cliniciansError}
            />
          )}
          {step === 2 && <SlotStep data={data} setData={setData} slots={slots} clinician={clinician} loading={slotsLoading} hasTemplate={hasTemplate} />}
          {step === 3 && <ReasonStep data={data} setData={setData} />}
          {step === 4 && <ReviewStep data={data} clinician={clinician} onEditStep={setStep} />}
        </div>

        {/* Sticky summary */}
        <Summary
          step={step}
          data={data}
          clinician={clinician}
          canContinue={canContinue}
          onBack={back}
          onNext={next}
          onConfirm={confirm}
          confirming={confirming}
        />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 1 — Clinician                                                          */
/* -------------------------------------------------------------------------- */

function ClinicianStep({
  data,
  setData,
  clinicians,
  loading,
  error,
}: {
  data: BookingState;
  setData: (d: BookingState) => void;
  clinicians: Clinician[];
  loading: boolean;
  error: string | null;
}) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filteredClinicians = q
    ? clinicians.filter((c) =>
        [c.name, c.specialty, c.location, c.department ?? "", c.tenantName ?? ""].some((field) =>
          field.toLowerCase().includes(q)
        )
      )
    : clinicians;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 animate-[fade-in_0.25s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Choose your clinician</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Your care team appears first; other clinicians in your tenant follow.
          </p>
        </div>
        <Input
          placeholder="Search clinicians…"
          leadingIcon={<Search />}
          className="w-full max-w-[200px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-muted-foreground)]">
          Loading clinicians…
        </div>
      ) : error ? (
        <div className="mt-6 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {filteredClinicians.map((c) => {
            const selected = data.clinicianId === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setData({ ...data, clinicianId: c.id, slotDay: null, slotTime: null })}
                  className={cn(
                    "group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                    selected
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-50)]/60 shadow-[var(--shadow-soft)]"
                      : "border-[var(--color-border)] hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-muted)]/30 hover:shadow-[var(--shadow-soft)]"
                  )}
                >
                  <Avatar className="size-12">
                    <AvatarFallback className="bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary)] text-white">
                      {c.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("text-sm font-semibold", selected && "text-[var(--color-primary-700)]")}>
                        {c.name}
                      </p>
                      {c.isAssigned && (
                        <Badge variant="success" size="sm">Your care team</Badge>
                      )}
                      {selected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          <CheckCircle2 className="size-3" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{c.specialty}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
                      {c.experienceYears > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Award className="size-3" /> {c.experienceYears} yrs experience
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        {c.mode === "office" ? <MapPin className="size-3" /> : <Video className="size-3" />}
                        {c.location}
                      </span>
                    </div>
                  </div>
                  <span className="hidden text-[11px] font-medium text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 sm:inline">
                    {selected ? "" : "Choose →"}
                  </span>
                </button>
              </li>
            );
          })}
          {filteredClinicians.length === 0 && (
            <li className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">
              {clinicians.length === 0
                ? "No clinicians available in your tenant yet — please ask the front desk."
                : `No clinicians match “${query}”.`}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 — Slot                                                               */
/* -------------------------------------------------------------------------- */

function SlotStep({
  data,
  setData,
  slots,
  clinician,
  loading,
  hasTemplate,
}: {
  data: BookingState;
  setData: (d: BookingState) => void;
  slots: SlotDay[];
  clinician: Clinician | null;
  loading?: boolean;
  hasTemplate?: boolean;
}) {
  // Show "15-min slots" in the header only when every day has the same cadence;
  // otherwise show "mixed slot lengths" (since each day badge is rendered below).
  const uniqueMinutes = Array.from(new Set(slots.map((s) => s.slotMinutes)));
  const headerHint =
    slots.length === 0
      ? "Open slots are pulled from the clinician's published availability"
      : uniqueMinutes.length === 1
        ? `${uniqueMinutes[0]}-min slots`
        : "Slot lengths vary by day — see each day's badge";
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 animate-[fade-in_0.25s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Choose a slot</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">{headerHint}</p>
        </div>
        {clinician && (
          <Badge variant="outline" size="sm" className="font-mono">
            {clinician.name}
          </Badge>
        )}
      </div>

      <div className="mt-5 space-y-5">
        {loading && (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30 p-6 text-center text-sm text-[var(--color-muted-foreground)]">
            Loading {clinician?.name ?? "clinician"}&apos;s availability…
          </p>
        )}
        {!loading && slots.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30 p-6 text-center text-sm text-[var(--color-muted-foreground)]">
            {hasTemplate
              ? `No open slots for ${clinician?.name ?? "this clinician"} in the next 7 days. Please try another clinician or check back later.`
              : `${clinician?.name ?? "This clinician"} hasn't published availability yet. Please pick another clinician.`}
          </p>
        )}
        {slots.map((s) => (
          <div key={s.day}>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                {s.day}
              </p>
              <Badge variant="muted" size="sm">{s.slotMinutes}-min slots</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.times.map((t) => {
                const selected = data.slotDay === s.day && data.slotTime === t;
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setData({ ...data, slotDay: s.day, slotTime: t })}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                      selected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-[var(--shadow-soft)]"
                        : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"
                    )}
                  >
                    <Clock3 className="size-3.5" /> {t}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 3 — Reason                                                             */
/* -------------------------------------------------------------------------- */

function ReasonStep({
  data,
  setData,
}: {
  data: BookingState;
  setData: (d: BookingState) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const added: BookingDocument[] = picked.map((f) => ({
      name: f.name,
      size: formatFileSize(f.size),
      sizeBytes: f.size,
    }));
    setData({ ...data, documents: [...data.documents, ...added] });
    toast.success(picked.length === 1 ? "Attachment added" : `${picked.length} attachments added`, {
      description: "Consent-bound · scanned for malware on upload",
    });
    e.target.value = "";
  }

  function remove(name: string) {
    setData({ ...data, documents: data.documents.filter((d) => d.name !== name) });
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 animate-[fade-in_0.25s_ease-out]">
      <h2 className="text-base font-semibold">Reason for visit</h2>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        A short summary helps your clinician prepare.
      </p>

      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reason">Visit reason</Label>
          <Input
            id="reason"
            placeholder="e.g., Lipid panel follow-up"
            value={data.reason}
            onChange={(e) => setData({ ...data, reason: e.target.value })}
          />
          {!data.reason.trim() && (
            <p className="text-[10px] text-[var(--color-muted-foreground)]">Required · keep it short</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            rows={4}
            placeholder="Any symptoms, concerns, or context the clinician should know"
            value={data.notes}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Attach pre-visit documents</Label>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={onPick}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30 px-4 py-6 text-xs text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
          >
            <Sparkles className="size-4 text-[var(--color-primary)]" />
            {data.documents.length === 0
              ? "Drop files or click to upload (consent-bound)"
              : "Click to add more files"}
          </button>
          {data.documents.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {data.documents.map((d) => (
                <li
                  key={d.name}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/50 px-2.5 py-1.5 text-[11px]"
                >
                  <Paperclip className="size-3.5 shrink-0 text-[var(--color-primary-700)]" />
                  <span className="flex-1 truncate font-medium">{d.name}</span>
                  <span className="shrink-0 text-[var(--color-muted-foreground)]">{d.size}</span>
                  <button
                    type="button"
                    onClick={() => remove(d.name)}
                    aria-label={`Remove ${d.name}`}
                    className="rounded p-0.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 4 — Review                                                             */
/* -------------------------------------------------------------------------- */

function ReviewStep({
  data,
  clinician,
  onEditStep,
}: {
  data: BookingState;
  clinician: Clinician | null;
  onEditStep: (step: number) => void;
}) {
  return (
    <div className="space-y-4 animate-[fade-in_0.25s_ease-out]">
      <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] to-[var(--color-primary-50)]/30 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
          Almost done — review your booking
        </p>
        <h2 className="mt-2 text-base font-semibold">
          {clinician?.name} · {data.slotDay} at {data.slotTime}
        </h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Click any field below to jump back and edit. Reminders will be scheduled at T-24h and T-1h.
        </p>
      </div>

      <ReviewBlock
        title="Clinician"
        icon={Stethoscope}
        onEdit={() => onEditStep(1)}
        items={
          clinician
            ? [
                { label: "Name", value: clinician.name },
                { label: "Specialty", value: clinician.specialty },
                { label: "Mode", value: `${clinician.mode === "office" ? "In-person" : "Telehealth"} · ${clinician.location}` },
              ]
            : []
        }
      />

      <ReviewBlock
        title="Slot"
        icon={CalIcon}
        onEdit={() => onEditStep(2)}
        items={[
          { label: "Date", value: data.slotDay ?? "—" },
          { label: "Time", value: data.slotTime ?? "—" },
          { label: "Duration", value: "15 min" },
        ]}
      />

      <ReviewBlock
        title="Reason"
        icon={FileText}
        onEdit={() => onEditStep(3)}
        items={[
          { label: "Visit reason", value: data.reason || "—" },
          ...(data.notes ? [{ label: "Notes", value: data.notes }] : []),
        ]}
      />

      <div className="flex items-center justify-center gap-2 pt-2">
        <SecurityBadge variant="encrypted" />
        <SecurityBadge variant="audited" />
      </div>
    </div>
  );
}

function ReviewBlock({
  title,
  icon: Icon,
  items,
  onEdit,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { label: string; value: string }[];
  onEdit: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
            <Icon className="size-3.5" />
          </span>
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <dl className="space-y-2 p-5 text-xs">
        {items.map((it) => (
          <div key={it.label} className="flex justify-between gap-3">
            <dt className="text-[var(--color-muted-foreground)]">{it.label}</dt>
            <dd className="text-right font-medium max-w-[60%]">{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sticky Summary                                                              */
/* -------------------------------------------------------------------------- */

function Summary({
  step,
  data,
  clinician,
  canContinue,
  onBack,
  onNext,
  onConfirm,
  confirming,
}: {
  step: number;
  data: BookingState;
  clinician: Clinician | null;
  canContinue: boolean;
  onBack: () => void;
  onNext: () => void;
  onConfirm: () => void;
  confirming?: boolean;
}) {
  return (
    <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Booking summary
        </p>
        {clinician ? (
          <div className="mt-3 flex items-center gap-3">
            <Avatar className="size-11">
              <AvatarFallback className="bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary)] text-white">
                {clinician.initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{clinician.name}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {clinician.specialty}
                {clinician.experienceYears > 0 ? ` · ${clinician.experienceYears} yrs` : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs italic text-[var(--color-muted-foreground)]">
            Pick a clinician to start
          </p>
        )}

        <dl className="mt-4 space-y-2.5 text-xs">
          <Row label="Date" value={data.slotDay} />
          <Row label="Time" value={data.slotTime} />
          <Row label="Duration" value={clinician ? "15 min" : null} />
          <Row
            label="Mode"
            value={clinician ? `${clinician.mode === "office" ? "In-person" : "Telehealth"} · ${clinician.location}` : null}
          />
          <Row label="Reschedule" value={clinician ? "Up to 24h before" : null} />
        </dl>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onBack}>
            <ArrowLeft className="size-3.5" /> Back
          </Button>
          {step < 4 ? (
            <Button className="flex-1" onClick={onNext} disabled={!canContinue}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button className="flex-1" onClick={onConfirm} disabled={confirming}>
              {confirming ? "Booking…" : <><CheckCircle2 /> Confirm</>}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Clinic policies
        </p>
        <ul className="mt-3 space-y-2 text-xs text-[var(--color-muted-foreground)]">
          <li className="flex gap-2">
            <CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" />
            Free reschedule up to 24h before slot
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" />
            Reminders at T-24h and T-1h
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" />
            Telehealth link shared 1h before
          </li>
        </ul>
        <div className="mt-3 flex gap-2">
          <SecurityBadge variant="encrypted" />
          <SecurityBadge variant="audited" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className={cn("font-medium text-right", !value && "italic text-[var(--color-muted-foreground)]")}>
        {value ?? "—"}
      </dd>
    </div>
  );
}
