"use client";

import { useEffect, useState } from "react";
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
  /** Which DocumentCategory this scope corresponds to (for live count). */
  category?: "Insurance" | "ID Proof" | "Lab Report" | "Imaging" | "Prescription" | "Other";
  desc: string;
  defaultOn: boolean;
}

// Category-driven scopes — same tags the patient sees on /patient/documents.
// Counts are computed from the patient store on render so the user can see
// how much PHI they're about to expose with each toggle.
const SCOPES: ScopeRow[] = [
  { key: "insurance",    icon: ScrollText, category: "Insurance",    desc: "Insurance cards & policy docs",       defaultOn: false },
  { key: "id_proof",     icon: FileText,   category: "ID Proof",     desc: "Aadhaar / passport / licence scans",  defaultOn: false },
  { key: "lab",          icon: Beaker,     category: "Lab Report",   desc: "Lab results & panels",                defaultOn: true  },
  { key: "imaging",      icon: FileImage,  category: "Imaging",      desc: "ECG / X-ray / MRI / scans",           defaultOn: false },
  { key: "prescriptions",icon: Pill,       category: "Prescription", desc: "Medications and Rx history",          defaultOn: true  },
  { key: "other",        icon: Brain,      category: "Other",        desc: "Everything else in your vault",       defaultOn: false },
];

interface Clinician {
  id: string;
  initials: string;
  name: string;
  department: string;
  role: string;
  isAssigned: boolean;
}

export default function GrantConsentPage() {
  const router = useRouter();
  const { state, addConsent, addNotification } = usePatientStore();
  const documents = state.documents;
  const [query, setQuery] = useState("");
  // Real clinicians from /api/patient/clinicians — patient's care team first,
  // then other active clinicians in the tenant. Replaces the hardcoded
  // "Priya / Rohan / Neha" demo list that lied on every fresh login.
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [clinLoading, setClinLoading] = useState(true);
  const [selectedName, setSelectedName] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/patient/clinicians", { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        type ApiRow = {
          id: string;
          name: string;
          initials: string;
          designation: string | null;
          department: string | null;
          isAssigned: boolean;
        };
        // Dedup by id in case the API ever returns the same clinician twice
        // (e.g. assigned + tenant-pool overlap on a different code path) —
        // the React list keys off id so collisions would warn loudly.
        const byId = new Map<string, Clinician>();
        for (const c of data.clinicians as ApiRow[]) {
          if (byId.has(c.id)) continue;
          byId.set(c.id, {
            id: c.id,
            initials: c.initials,
            name: c.name,
            department: c.department ?? c.designation ?? "Care team",
            role: [c.department, c.designation].filter(Boolean).join(" · ") || "Care team",
            isAssigned: !!c.isAssigned,
          });
        }
        const list = [...byId.values()];
        setClinicians(list);
        if (list.length > 0 && !selectedName) setSelectedName(list[0].name);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setClinLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [scopeOn, setScopeOn] = useState<Record<ConsentScope, boolean>>(() => {
    const out = {} as Record<ConsentScope, boolean>;
    for (const s of SCOPES) out[s.key] = s.defaultOn;
    return out;
  });
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [ackPolicy, setAckPolicy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const q = query.trim().toLowerCase();
  const visible = q ? clinicians.filter((c) => `${c.name} ${c.role}`.toLowerCase().includes(q)) : clinicians;
  const selected = clinicians.find((c) => c.name === selectedName) ?? clinicians[0];

  const activeScopes = (Object.keys(scopeOn) as ConsentScope[]).filter((k) => scopeOn[k]);
  const canSubmit = ackPolicy && activeScopes.length > 0 && !submitting && !!selected;

  async function submit() {
    if (!canSubmit || !selected) return;
    setSubmitting(true);

    // Compute the expiry from the chosen duration so the local mirror matches
    // what the server stores (the API derives expiresAt from durationHours).
    const expiresAt = durationHours
      ? new Date(Date.now() + durationHours * 3_600_000).toISOString()
      : null;

    // Persist to consent_requests so Compliance / Auditor surfaces see this
    // grant. We keep the local-store mirror alive so the patient's own page
    // updates immediately even if the network call fails.
    let dbConsentId: string | null = null;
    try {
      const res = await fetch("/api/patient/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicianId: selected.id,
          scopes: activeScopes,
          durationHours,
          policyVersion: "v2.4",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        toast.error("Could not save consent on the server", {
          description: json?.error ?? "Local copy kept; ask compliance to retry.",
        });
      } else {
        dbConsentId = json.consent?.id ?? null;
      }
    } catch {
      toast.error("Network error — local copy kept; not visible to compliance yet.");
    }

    const con = addConsent({
      clinician: selected.name,
      department: selected.department,
      scopes: activeScopes,
      policyVersion: "v2.4",
      expiresAt,
    });
    addNotification({
      title: "Consent granted",
      body: `${selected.name} · ${activeScopes.map((s) => CONSENT_SCOPE_LABEL[s]).join(", ")}`,
      type: "consent",
      href: `/patient/consents/${dbConsentId ?? con.id}`,
    });
    toast.success("Consent granted", {
      description: `${selected.name} can now read: ${activeScopes.map((s) => CONSENT_SCOPE_LABEL[s]).join(", ")}${
        expiresAt ? ` · expires ${new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : " · open-ended"
      }`,
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

            {clinLoading ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/20 px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                Loading clinicians…
              </p>
            ) : clinicians.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/20 px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                No clinicians available in your tenant yet. Once a clinician is assigned (or you book an appointment) they&apos;ll appear here.
              </p>
            ) : visible.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/20 px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                No clinicians or roles match your search.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {visible.map((c) => (
                  <li key={c.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                        c.name === selectedName
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-50)]/40"
                          : "border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)]/30"
                      }`}
                    >
                      <Avatar className="size-10"><AvatarFallback>{c.initials}</AvatarFallback></Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{c.name}</p>
                          {c.isAssigned && (
                            <Badge variant="success" size="sm">Your care team</Badge>
                          )}
                        </div>
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

          {/* Scope — document-category-driven checklist matching the
              patient's /patient/documents Tags sidebar. Counts come from the
              patient store so the user sees exactly how many docs each scope
              would expose. */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold">Scope</h2>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Choose which document categories this clinician can read. Counts reflect what&apos;s currently in your vault.
            </p>
            <div className="mt-4 space-y-2">
              {SCOPES.map((s) => {
                const Icon = s.icon;
                const count = s.category
                  ? documents.filter((d) => d.category === s.category).length
                  : 0;
                const checked = !!scopeOn[s.key];
                return (
                  <label
                    key={s.key}
                    className={`flex items-center gap-3 rounded-xl border p-3.5 transition-colors cursor-pointer ${
                      checked
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-50)]/40"
                        : "border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)]/30"
                    }`}
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                      <Icon className="size-4.5" />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{CONSENT_SCOPE_LABEL[s.key]}</p>
                        <Badge variant="muted" size="sm">{count}</Badge>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted-foreground)]">{s.desc}</p>
                    </div>
                    <Switch
                      checked={checked}
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
            <DurationPicker value={durationHours} onChange={setDurationHours} />
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
              {selected ? (
                <>
                  <Avatar className="size-9"><AvatarFallback>{selected.initials}</AvatarFallback></Avatar>
                  <div>
                    <p className="text-sm font-semibold">{selected.name}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{selected.department}</p>
                  </div>
                </>
              ) : (
                <p className="text-xs italic text-[var(--color-muted-foreground)]">
                  Pick a clinician above to start.
                </p>
              )}
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
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted-foreground)]">Duration</dt>
                <dd className="text-right">
                  {durationHours === null
                    ? "Open-ended"
                    : durationHours < 48
                      ? `${durationHours} hours`
                      : `${Math.round(durationHours / 24)} days`}
                  {durationHours !== null && (
                    <span className="block text-[10px] text-[var(--color-muted-foreground)]">
                      until {new Date(Date.now() + durationHours * 3_600_000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </dd>
              </div>
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
