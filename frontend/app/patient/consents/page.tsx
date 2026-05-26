"use client";

import Link from "next/link";
import {
  Plus,
  Shield,
  Beaker,
  Pill,
  FileImage,
  FileText,
  ChevronRight,
  XCircle,
  Hourglass,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecurityBadge } from "@/components/shared/security-badge";
import { RevokeConsentDialog, ConsentRequestDialog } from "@/components/shared/form-dialogs";
import { ActionButton } from "@/components/shared/action-button";
import {
  usePatientStore,
  CONSENT_SCOPE_LABEL,
  type Consent,
  type ConsentScope,
} from "@/lib/patient-store";

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
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function scopeIcon(s: ConsentScope) {
  if (s === "lab") return Beaker;
  if (s === "prescriptions") return Pill;
  if (s === "imaging") return FileImage;
  if (s === "notes") return FileText;
  return Shield;
}

export default function ConsentsPage() {
  const { state, revokeConsent, addConsent, addNotification } = usePatientStore();

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const active = state.consents.filter((c) => c.status === "active");
  const history = state.consents.filter((c) => c.status === "revoked");

  return (
    <>
      <PageHeader
        eyebrow="Consents"
        title="Who can see what"
        description="You control which clinicians can read which record categories. Revocation takes effect on the very next API call."
        actions={
          <Button asChild>
            <Link href="/patient/consents/grant"><Plus /> Grant new consent</Link>
          </Button>
        }
      />

      {/* Pending request — demo banner, not store-backed */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)]/30 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-card)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)] ring-1 ring-[var(--color-warning)]/30">
              <Hourglass className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Pending consent request</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                <span className="font-medium text-[var(--color-foreground)]">Dr. Neha Kapoor</span> requested access to your <em>Imaging</em> records.
                Policy v2.4 will apply on grant.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <ActionButton
              size="sm"
              variant="outline"
              toastMessage="Request declined"
              toastDescription="Dr. Neha Kapoor will be notified"
              toastVariant="info"
            >
              Decline
            </ActionButton>
            <ConsentRequestDialog
              requester="Dr. Neha Kapoor"
              scope="Imaging"
              triggerLabel="Review & approve"
              triggerProps={{
                size: "sm",
                onClick: () => {
                  // The ConsentRequestDialog approves with toast-only; mirror
                  // the grant into the store so the new consent appears in the
                  // Active tab immediately.
                  const con = addConsent({
                    clinician: "Dr. Neha Kapoor",
                    department: "Dermatology",
                    scopes: ["imaging"],
                    policyVersion: "v2.4",
                    expiresAt: null,
                  });
                  addNotification({
                    title: "Consent granted",
                    body: `Dr. Neha Kapoor · Imaging`,
                    type: "consent",
                    href: `/patient/consents/${con.id}`,
                  });
                },
              }}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active · {active.length}</TabsTrigger>
          <TabsTrigger value="history">History · {history.length}</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {active.length === 0 ? (
            <EmptyActive />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {active.map((c) => (
                <ConsentCard
                  key={c.id}
                  c={c}
                  onRevoke={() => {
                    revokeConsent(c.id);
                    addNotification({
                      title: "Consent revoked",
                      body: `${c.clinician} · access removed`,
                      type: "consent",
                    });
                    toast.warning("Consent revoked", { description: `${c.clinician} · effective on next API call` });
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
              No revoked or expired consents.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <ul className="divide-y divide-[var(--color-border)]">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 p-5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
                      <XCircle className="size-4" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{h.clinician}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        Revoked by patient · {h.revokedAt ? dateLabel(h.revokedAt) : ""}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{h.id}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="policies">
          <div className="space-y-3">
            {[
              { v: "v2.4", active: true, t: "Updated May 1, 2026", desc: "Adds explicit data-portability notice and clarifies the audit retention window." },
              { v: "v2.3", active: false, t: "Updated Feb 12, 2026", desc: "Introduces time-bounded consent expiration and re-consent campaigns." },
              { v: "v2.2", active: false, t: "Updated Sep 1, 2025", desc: "Initial granular scope catalog." },
            ].map((p) => (
              <div key={p.v} className="flex items-start gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-mono text-xs font-semibold">
                  {p.v}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">Policy {p.v}</p>
                    {p.active && <Badge variant="success" size="sm" dot>Active</Badge>}
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{p.t}</p>
                  <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{p.desc}</p>
                </div>
                <ActionButton
                  variant="outline"
                  size="sm"
                  toastMessage={`Opening policy ${p.v}`}
                  toastVariant="info"
                >
                  View text
                </ActionButton>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function ConsentCard({ c, onRevoke }: { c: Consent; onRevoke: () => void }) {
  const scopeLabels = c.scopes.map((s) => CONSENT_SCOPE_LABEL[s]).join(", ");
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-success-soft)]/40 to-transparent p-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-10"><AvatarFallback>{initials(c.clinician)}</AvatarFallback></Avatar>
          <div>
            <p className="text-sm font-semibold">{c.clinician}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">{c.department ?? "Care Team"}</p>
          </div>
        </div>
        <Badge variant="success" size="sm" dot>Active</Badge>
      </div>

      <div className="p-5 text-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Scope</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.scopes.map((s) => {
            const Icon = scopeIcon(s);
            return (
              <Badge key={s} variant="default" size="sm">
                <Icon /> {CONSENT_SCOPE_LABEL[s]}
              </Badge>
            );
          })}
        </div>

        <dl className="mt-5 space-y-2 text-xs">
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted-foreground)]">Granted</dt>
            <dd>{dateLabel(c.grantedAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted-foreground)]">Expires</dt>
            <dd>{c.expiresAt ? dateLabel(c.expiresAt) : "Open-ended"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted-foreground)]">Policy</dt>
            <dd className="font-mono">{c.policyVersion}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted-foreground)]">Consent ID</dt>
            <dd className="font-mono">{c.id}</dd>
          </div>
        </dl>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-muted)]/30 px-5 py-3">
        <SecurityBadge variant="audited" />
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/patient/consents/${c.id}`}>Details <ChevronRight /></Link>
          </Button>
          <RevokeConsentDialog
            clinician={c.clinician}
            scope={scopeLabels}
            onConfirm={onRevoke}
            triggerProps={{
              variant: "ghost",
              size: "sm",
              className: "text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyActive() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
        <Shield className="size-5" />
      </div>
      <p className="text-sm font-medium">No active consents</p>
      <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
        Grant a clinician access to specific record categories. You can revoke any scope at any time.
      </p>
      <Button asChild size="sm" className="mt-1">
        <Link href="/patient/consents/grant"><Plus /> Grant consent</Link>
      </Button>
    </div>
  );
}

