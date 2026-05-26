"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Beaker,
  Pill,
  FileImage,
  FileText,
  Brain,
  ScrollText,
  Shield,
  ShieldOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { SecurityBadge } from "@/components/shared/security-badge";
import { RevokeConsentDialog } from "@/components/shared/form-dialogs";
import {
  usePatientStore,
  CONSENT_SCOPE_LABEL,
  type Consent,
  type ConsentScope,
} from "@/lib/patient-store";

const ALL_SCOPES: { key: ConsentScope; icon: React.ComponentType<{ className?: string }>; desc: string; category: string }[] = [
  { key: "lab", icon: Beaker, desc: "Read existing + new lab reports", category: "Lab Report" },
  { key: "prescriptions", icon: Pill, desc: "View current and history", category: "Prescription" },
  { key: "imaging", icon: FileImage, desc: "DICOM and radiology reports", category: "Imaging" },
  { key: "notes", icon: FileText, desc: "Read finalized clinical notes only", category: "Clinical Note" },
  { key: "mental_health", icon: Brain, desc: "Sensitive category · separate consent", category: "Mental Health" },
];

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
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ConsentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { state, revokeConsent, updateConsentScopes, addNotification } = usePatientStore();

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const c = state.consents.find((x) => x.id === id);
  if (!c) return <NotFound id={id} />;

  const granted = ALL_SCOPES.filter((s) => c.scopes.includes(s.key));
  const denied = ALL_SCOPES.filter((s) => !c.scopes.includes(s.key));

  function toggleScope(scope: ConsentScope, on: boolean) {
    if (!c) return;
    const next = on ? Array.from(new Set([...c.scopes, scope])) : c.scopes.filter((x) => x !== scope);
    updateConsentScopes(c.id, next);
    toast.success(
      on ? `${CONSENT_SCOPE_LABEL[scope]} access granted` : `${CONSENT_SCOPE_LABEL[scope]} access removed`,
      { description: `${c.clinician} · effective on next API call` },
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/patient/consents" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Consents
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{id}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <div className="flex items-start gap-4">
              <Avatar className="size-12">
                <AvatarFallback>{initials(c.clinician)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                {c.status === "active" ? (
                  <Badge variant="success" size="sm" dot>Active consent</Badge>
                ) : (
                  <Badge variant="danger" size="sm" dot>Revoked</Badge>
                )}
                <h1 className="mt-2 text-xl font-semibold tracking-tight">
                  {c.clinician} · {c.department ?? "Care team"}
                </h1>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  Authorized to read: {c.scopes.length === 0 ? "no categories" : c.scopes.map((s) => CONSENT_SCOPE_LABEL[s]).join(", ")}.
                </p>
              </div>
            </div>

            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Adjust scope
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Toggle individual categories. Changes apply on the very next API call.
            </p>
            <div className="mt-3 space-y-2">
              {granted.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.key}
                    className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                      <Icon className="size-4" />
                    </span>
                    <div className="flex-1">
                      <Link
                        href={`/patient/records?category=${encodeURIComponent(s.category)}`}
                        className="text-sm font-semibold hover:underline"
                      >
                        {CONSENT_SCOPE_LABEL[s.key]}
                      </Link>
                      <p className="text-[11px] text-[var(--color-muted-foreground)]">{s.desc}</p>
                    </div>
                    <Switch
                      checked
                      onCheckedChange={(v) => toggleScope(s.key, v)}
                      disabled={c.status !== "active"}
                    />
                  </div>
                );
              })}
            </div>

            {denied.length > 0 && c.status === "active" && (
              <>
                <h2 className="mt-7 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Not currently allowed
                </h2>
                <div className="mt-3 space-y-2 text-sm">
                  {denied.map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.key}
                        className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3"
                      >
                        <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                          <Icon className="size-4" />
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{CONSENT_SCOPE_LABEL[s.key]}</p>
                          <p className="text-[11px] text-[var(--color-muted-foreground)]">{s.desc}</p>
                        </div>
                        <Switch onCheckedChange={(v) => toggleScope(s.key, v)} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <h2 className="mt-7 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              What this consent does <em>not</em> allow
            </h2>
            <div className="mt-3 space-y-2 text-sm">
              {[
                "Editing or finalizing any record",
                "Sharing your data with third parties",
                "Reading drafts before they're finalized",
              ].map((x) => (
                <div key={x} className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-3 py-2">
                  <ShieldOff className="size-4 text-[var(--color-danger)]" />
                  <span className="text-[var(--color-muted-foreground)]">{x}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lifecycle */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold">Consent lifecycle</h2>
            <ol className="mt-4 space-y-3.5">
              <LifecycleRow icon={CheckCircle2} t={`Consent granted on policy ${c.policyVersion}`} time={dateLabel(c.grantedAt)} done />
              <LifecycleRow icon={ScrollText} t="Policy text acknowledged + timestamp signature captured" time={dateLabel(c.grantedAt)} done />
              <LifecycleRow
                icon={XCircle}
                t={c.status === "revoked" ? "Revoked by patient" : "Revocation (none)"}
                time={c.revokedAt ? dateLabel(c.revokedAt) : "Open-ended"}
                done={c.status === "revoked"}
              />
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          {/* Metadata */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h3 className="text-sm font-semibold">Metadata</h3>
            <dl className="mt-3 space-y-2.5 text-xs">
              <Row label="Consent ID" value={c.id} mono />
              <Row label="Policy version" value={c.policyVersion} mono />
              <Row label="Granted" value={dateLabel(c.grantedAt)} />
              <Row label="Expires" value={c.expiresAt ? dateLabel(c.expiresAt) : "Open-ended"} />
              <Row label="Granted by" value="Patient · self" />
              <Row label="Status" value={c.status === "active" ? "Active" : "Revoked"} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <SecurityBadge variant="encrypted" />
              <SecurityBadge variant="audited" />
            </div>
          </div>

          {/* Revoke */}
          {c.status === "active" && (
            <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/30 p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-card)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/30">
                  <AlertTriangle className="size-4" />
                </span>
                <div className="text-xs">
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">Revoke this consent</p>
                  <p className="mt-1 text-[var(--color-muted-foreground)]">
                    Takes effect immediately on the next API call. {c.clinician} will lose
                    access to the categories above. This action is audit-logged.
                  </p>
                  <RevokeConsentDialog
                    clinician={c.clinician}
                    scope={c.scopes.map((s) => CONSENT_SCOPE_LABEL[s]).join(", ") || "all scopes"}
                    triggerLabel="Revoke access"
                    triggerProps={{ variant: "destructive", size: "sm", className: "mt-3 w-full" }}
                    onConfirm={() => {
                      revokeConsent(c.id);
                      addNotification({
                        title: "Consent revoked",
                        body: `${c.clinician} · access removed`,
                        type: "consent",
                      });
                      toast.warning("Consent revoked", { description: `${c.clinician} · effective on next API call` });
                      router.push("/patient/consents");
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function LifecycleRow({
  icon: Icon,
  t,
  time,
  done,
}: {
  icon: React.ComponentType<{ className?: string }>;
  t: string;
  time: string;
  done: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
          done
            ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
            : "border border-dashed border-[var(--color-border)] text-[var(--color-muted-foreground)]"
        }`}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="flex-1">
        <p className={`text-sm ${done ? "" : "text-[var(--color-muted-foreground)]"}`}>{t}</p>
        <p className="text-[10px] text-[var(--color-muted-foreground)]">{time}</p>
      </div>
    </li>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className={`font-medium text-right ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/patient/consents" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Consents
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{id}</span>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
          <Shield className="size-5" />
        </div>
        <p className="text-sm font-medium">Consent not found</p>
        <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
          The consent <code className="font-mono">{id}</code> doesn&apos;t exist or has been removed.
        </p>
        <Button asChild size="sm">
          <Link href="/patient/consents">Back to consents</Link>
        </Button>
      </div>
    </div>
  );
}
