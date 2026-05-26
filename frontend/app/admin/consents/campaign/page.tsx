"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useAdminStore } from "@/lib/admin-store";

export default function ReconsentCampaignPage() {
  const { state, startReconsentCampaign } = useAdminStore();
  const [newVersion, setNewVersion] = useState("v2.5");
  const [summary, setSummary] = useState(
    "Adds clarification on data portability and updates the retention disclosure.",
  );
  const [ack, setAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const activeConsents = state.assignments.filter((a) => a.status === "active");
  const affectedPatients = new Set(activeConsents.map((a) => a.patientId)).size;

  function submit() {
    setSubmitting(true);
    setTimeout(() => {
      startReconsentCampaign(newVersion);
      toast.success(`Re-consent campaign launched for ${newVersion}`, {
        description: `${affectedPatients} patient${affectedPatients === 1 ? "" : "s"} will be prompted on next login`,
      });
      setSubmitting(false);
      setAck(false);
    }, 400);
  }

  const isUpgrade = compareVersions(newVersion, state.consentPolicyVersion) > 0;
  const canSubmit = ack && isUpgrade && !submitting && affectedPatients > 0;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Dashboard
        </Link>
        <span>/</span>
        <span>Re-consent campaign</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Re-consent campaign</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          When you publish a new version of the consent policy, existing patient
          consents need to be re-accepted. This page launches the campaign:
          every active assignment becomes <em>pending consent</em>, clinicians
          lose record access until the patient re-grants under the new policy.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4" /> Current active policy
              </h2>
              <Badge variant="success" size="sm" dot>{state.consentPolicyVersion}</Badge>
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              All {affectedPatients} active patient assignment(s) are currently bound to {state.consentPolicyVersion}.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 space-y-4">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
              <Megaphone className="size-4" /> New policy version
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rc-version">Version</Label>
                <Input
                  id="rc-version"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  placeholder="v2.5"
                  className="font-mono"
                />
                {!isUpgrade && (
                  <p className="text-[11px] text-[var(--color-danger)]">
                    Must be a higher version than current ({state.consentPolicyVersion}).
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-effective">Effective date</Label>
                <Input id="rc-effective" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc-summary">Summary of changes</Label>
              <Textarea
                id="rc-summary"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief summary shown to patients in the re-consent prompt."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/30 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 text-[var(--color-danger)]" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold">This action is broad and audit-logged</p>
                <ul className="space-y-1 text-xs text-[var(--color-muted-foreground)]">
                  <li>• All {affectedPatients} active assignments will become <em>pending consent</em>.</li>
                  <li>• Clinicians lose access to patient records until each patient re-grants.</li>
                  <li>• Patients are prompted on next login.</li>
                  <li>• You cannot bulk-undo — patients must opt back in individually.</li>
                </ul>
                <label className="flex items-start gap-2 pt-1 text-xs">
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
                  />
                  <span>I understand this will pause clinician PHI access until each patient re-consents.</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Impact</p>
            <dl className="mt-3 space-y-2.5 text-xs">
              <Row label="Active assignments" value={String(activeConsents.length)} />
              <Row label="Affected patients" value={String(affectedPatients)} />
              <Row label="Current policy" value={state.consentPolicyVersion} mono />
              <Row label="Target policy" value={newVersion} mono />
            </dl>
            <Button
              className="mt-5 w-full"
              variant="destructive"
              onClick={submit}
              disabled={!canSubmit}
            >
              {submitting ? <><Loader2 className="animate-spin" /> Launching…</> : <><Megaphone /> Launch campaign</>}
            </Button>
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link href="/admin/dashboard">Cancel</Link>
            </Button>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-[var(--color-muted-foreground)]">
              <CheckCircle2 className="size-3 text-[var(--color-success)]" />
              Audit ledger: <span className="font-mono">consent.campaign</span>
            </div>
          </div>
        </div>
      </div>
    </>
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

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}
