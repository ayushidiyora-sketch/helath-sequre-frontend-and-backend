"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Beaker,
  Pill,
  FileImage,
  FileText,
  Brain,
  ScrollText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { DurationPicker } from "./duration-picker";
import {
  usePatientStore,
  CONSENT_SCOPE_LABEL,
  type ConsentScope,
} from "@/lib/patient-store";

interface ScopeRow {
  key: ConsentScope;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  defaultOn: boolean;
}

const SCOPES: ScopeRow[] = [
  { key: "lab", icon: Beaker, desc: "Read existing and future lab results", defaultOn: true },
  { key: "prescriptions", icon: Pill, desc: "View current medications and history", defaultOn: true },
  { key: "imaging", icon: FileImage, desc: "DICOM and radiology reports", defaultOn: false },
  { key: "notes", icon: FileText, desc: "Finalized notes only — never drafts", defaultOn: true },
  { key: "mental_health", icon: Brain, desc: "Separate consent — sensitive category", defaultOn: false },
];

const CLINICIANS = [
  { initials: "PS", name: "Dr. Priya Shah", department: "Cardiology", role: "Cardiology · MD, DM" },
  { initials: "RI", name: "Dr. Rohan Iyer", department: "General Medicine", role: "General Medicine · MBBS, MD" },
  { initials: "NK", name: "Dr. Neha Kapoor", department: "Dermatology", role: "Dermatology · MBBS" },
];

export default function GrantConsentPage() {
  const router = useRouter();
  const { addConsent, addNotification } = usePatientStore();
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState(CLINICIANS[0].name);
  const [scopeOn, setScopeOn] = useState<Record<ConsentScope, boolean>>(() => {
    const out = {} as Record<ConsentScope, boolean>;
    for (const s of SCOPES) out[s.key] = s.defaultOn;
    return out;
  });
  const [ackPolicy, setAckPolicy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const q = query.trim().toLowerCase();
  const visible = q ? CLINICIANS.filter((c) => `${c.name} ${c.role}`.toLowerCase().includes(q)) : CLINICIANS;
  const selected = CLINICIANS.find((c) => c.name === selectedName) ?? CLINICIANS[0];

  const activeScopes = (Object.keys(scopeOn) as ConsentScope[]).filter((k) => scopeOn[k]);
  const canSubmit = ackPolicy && activeScopes.length > 0 && !submitting;

  function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const con = addConsent({
      clinician: selected.name,
      department: selected.department,
      scopes: activeScopes,
      policyVersion: "v2.4",
      expiresAt: null,
    });
    addNotification({
      title: "Consent granted",
      body: `${selected.name} · ${activeScopes.map((s) => CONSENT_SCOPE_LABEL[s]).join(", ")}`,
      type: "consent",
      href: `/patient/consents/${con.id}`,
    });
    toast.success("Consent granted", {
      description: `${selected.name} can now read: ${activeScopes.map((s) => CONSENT_SCOPE_LABEL[s]).join(", ")}`,
    });
    setTimeout(() => router.push("/patient/consents"), 400);
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/patient/consents" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Consents
        </Link>
        <span>/</span>
        <span>Grant new</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Grant a new consent</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          You decide who, what, and for how long. You can revoke this consent at
          any time from the consents page.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {/* Recipient */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold">Recipient</h2>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Choose a clinician from your care team or search by license number.
            </p>
            <Input
              placeholder="Search clinicians or roles…"
              leadingIcon={<Search />}
              className="mt-4"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {visible.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/20 px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                No clinicians or roles match your search.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {visible.map((c) => (
                  <li key={c.name}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                        c.name === selectedName
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-50)]/40"
                          : "border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)]/30"
                      }`}
                    >
                      <Avatar className="size-10"><AvatarFallback>{c.initials}</AvatarFallback></Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">{c.role}</p>
                      </div>
                      <input
                        type="radio"
                        name="rec"
                        checked={c.name === selectedName}
                        onChange={() => setSelectedName(c.name)}
                        className="size-4 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Scope */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold">Scope</h2>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Choose which record categories this clinician can read.
            </p>
            <div className="mt-4 space-y-2">
              {SCOPES.map((s) => {
                const Icon = s.icon;
                return (
                  <label
                    key={s.key}
                    className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3.5 transition-colors hover:bg-[var(--color-muted)]/30"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                      <Icon className="size-4.5" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{CONSENT_SCOPE_LABEL[s.key]}</p>
                      <p className="text-[11px] text-[var(--color-muted-foreground)]">{s.desc}</p>
                    </div>
                    <Switch
                      checked={scopeOn[s.key]}
                      onCheckedChange={(v) => setScopeOn((curr) => ({ ...curr, [s.key]: v }))}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold">Duration</h2>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Open-ended consents stay active until you revoke them. Time-bound
              consents expire automatically.
            </p>
            <DurationPicker />
          </div>

          {/* Policy ack */}
          <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-50)]/40 p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-card)] text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary)]/20">
                <ScrollText className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Active policy version: v2.4</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  Granting under this policy stores the full text and your
                  timestamped signature. Read it once and we&apos;ll keep it on file.
                </p>
                <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
                  By granting this consent you authorize the named clinician to read the selected PHI categories within the
                  duration above. All access is audit-logged. You may revoke at any time;
                  revocation takes effect on the next API call. Audit and consent records are
                  retained for a minimum of six years for HIPAA compliance.
                </div>
                <label className="mt-3 flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
                  <input
                    type="checkbox"
                    checked={ackPolicy}
                    onChange={(e) => setAckPolicy(e.target.checked)}
                    className="mt-0.5 size-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
                  />
                  I have read policy v2.4 and authorize this consent.
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              You&apos;re about to grant
            </p>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
              <Avatar className="size-9"><AvatarFallback>{selected.initials}</AvatarFallback></Avatar>
              <div>
                <p className="text-sm font-semibold">{selected.name}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{selected.department}</p>
              </div>
            </div>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Scope</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activeScopes.length === 0 ? (
                <span className="text-[11px] italic text-[var(--color-muted-foreground)]">
                  Pick at least one scope to enable consent.
                </span>
              ) : (
                activeScopes.map((s) => (
                  <Badge key={s} variant="default" size="sm">
                    {CONSENT_SCOPE_LABEL[s]}
                  </Badge>
                ))
              )}
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-[var(--color-muted-foreground)]">Duration</dt><dd>Open-ended</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-muted-foreground)]">Policy</dt><dd className="font-mono">v2.4</dd></div>
            </dl>
            <Button className="mt-5 w-full" onClick={submit} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> Signing…
                </>
              ) : (
                <>Sign &amp; grant consent <ArrowRight /></>
              )}
            </Button>
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link href="/patient/consents">Cancel</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
