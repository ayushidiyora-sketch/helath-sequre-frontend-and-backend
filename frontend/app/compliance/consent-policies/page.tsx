"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ScrollText, Edit, History, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Policy {
  id: string;
  version: string;
  slug: string;
  status: "active" | "archived" | "draft";
  summary: string;
  period: string;
  adoption: number;
  consents: number;
  scopeCategories: number;
  roleBindings: number;
}

export default function ComplianceConsentPolicies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/compliance/consent-policies", { cache: "no-store" });
        const json = await res.json();
        if (!alive || !json?.ok) return;
        setPolicies(json.policies as Policy[]);
      } catch (err) {
        console.error("[consent-policies] fetch", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <>
      <PageHeader
        eyebrow="Consent policies"
        title="Versioned policy text"
        description="Activating a new version triggers a re-consent campaign for affected patients. Old versions are retained for the lifetime of associated PHI."
        actions={
          <Button asChild size="sm">
            <Link href="/compliance/consent-policies/new">
              <Plus /> Create New Policy
            </Link>
          </Button>
        }
      />

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading policies…
          </div>
        ) : policies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
            No policies in this tenant yet — click <span className="font-semibold">Create New Policy</span> to draft your first version.
          </div>
        ) : (
          policies.map((p) => (
            <PolicyCard key={p.id} p={p} onChange={reload} />
          ))
        )}
      </div>
    </>
  );
}

function PolicyCard({ p, onChange }: { p: Policy; onChange: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] p-5">
        <div className="flex items-start gap-3">
          <span className={`flex size-12 items-center justify-center rounded-xl text-base font-mono font-semibold ${p.status === "active" ? "bg-[var(--color-primary)] text-white" : p.status === "draft" ? "bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]" : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"}`}>
            {p.version}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Policy {p.version}</h3>
              {p.status === "active" ? (
                <Badge variant="success" size="sm" dot>Active</Badge>
              ) : p.status === "draft" ? (
                <Badge variant="warning" size="sm">Draft</Badge>
              ) : (
                <Badge variant="muted" size="sm">Archived</Badge>
              )}
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)]">{p.period}</p>
            <p className="mt-2 max-w-2xl text-sm">{p.summary}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button asChild variant="outline" size="sm">
            <Link href={`/compliance/consent-policies/${p.slug}`}>
              <ScrollText /> View text
            </Link>
          </Button>
          {p.status === "active" || p.status === "draft" ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/compliance/consent-policies/${p.slug}/edit`}>
                <Edit /> Edit draft
              </Link>
            </Button>
          ) : null}
          {p.status === "active" ? (
            <>
              <ReConsentCampaignButton policyId={p.id} version={p.version} onDone={onChange} />
              <DeactivateButton policyId={p.id} version={p.version} onDone={onChange} />
            </>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/compliance/consent-policies/${p.slug}#history`}>
                <History /> Version history
              </Link>
            </Button>
          )}
          {p.status === "draft" ? (
            <ActivateDraftButton policyId={p.id} version={p.version} onDone={onChange} label="Activate" />
          ) : null}
          {p.status === "archived" ? (
            <ActivateDraftButton policyId={p.id} version={p.version} onDone={onChange} label="Re-activate" />
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Adoption</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-2xl font-semibold tabular-nums">{p.adoption}%</p>
            <Progress value={p.adoption} className="flex-1" />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Active consents</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{p.consents.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Granular scopes</p>
          <p className="mt-1 text-xs">{p.scopeCategories} categories · {p.roleBindings} role bindings</p>
        </div>
      </div>
    </div>
  );
}

function ReConsentCampaignButton({
  policyId,
  version,
  onDone,
}: {
  policyId: string;
  version: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function send() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/compliance/re-consent-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        toast.error(json?.error ?? "Could not start campaign");
        return;
      }
      toast.success("Re-consent campaign started", {
        description: `Bulk dispatch queued · ${(json.campaign?.recipientCount ?? 0).toLocaleString()} recipients · audit-logged`,
      });
      setOpen(false);
      onDone();
    } catch {
      toast.error("Network error — please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Send /> Re-consent campaign
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trigger re-consent campaign?</DialogTitle>
            <DialogDescription>
              Bulk email + in-app notice will go to every patient still on a prior policy version. Campaign details are written to the audit ledger.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={send} disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send />}
              Send campaign for {version}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActivateDraftButton({
  policyId,
  version,
  onDone,
  label = "Activate",
}: {
  policyId: string;
  version: string;
  onDone: () => void;
  label?: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  async function activate() {
    if (!confirm(`${label} policy ${version}? This will archive the current active policy.`)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/compliance/consent-policies/${policyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate" }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) { toast.error(json?.error ?? `${label} failed`); return; }
      toast.success(`Policy ${version} active`, { description: "Prior version archived · audit-logged" });
      onDone();
    } catch {
      toast.error("Network error");
    } finally { setSubmitting(false); }
  }
  return (
    <Button size="sm" onClick={activate} disabled={submitting}>
      {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send />}
      {label}
    </Button>
  );
}

function DeactivateButton({
  policyId,
  version,
  onDone,
}: {
  policyId: string;
  version: string;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  async function deactivate() {
    if (!confirm(`Deactivate (archive) policy ${version}? Patients on this policy will need a fresh consent or re-activation.`)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/compliance/consent-policies/${policyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) { toast.error(json?.error ?? "Deactivate failed"); return; }
      toast.warning(`Policy ${version} deactivated`, { description: "Archived · audit-logged" });
      onDone();
    } catch {
      toast.error("Network error");
    } finally { setSubmitting(false); }
  }
  return (
    <Button variant="outline" size="sm" onClick={deactivate} disabled={submitting}>
      {submitting ? <Loader2 className="size-4 animate-spin" /> : <History />}
      Deactivate
    </Button>
  );
}
