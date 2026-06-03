"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Edit, Send, History, ScrollText, Megaphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PolicySection { heading: string; body: string }
interface HistoryEntry { date: string; event: string }

interface Policy {
  id: string;
  version: string;
  slug: string;
  status: "active" | "archived" | "draft";
  summary: string;
  period: string;
  sections: PolicySection[];
  history: HistoryEntry[];
  scopeCategories: number;
  roleBindings: number;
  adoption: number;
  consents: number;
}

export default function PolicyVersionPage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = use(params);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/compliance/consent-policies/${encodeURIComponent(version)}`, { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (res.status === 404 || !json?.ok) { setMissing(true); return; }
        // Detail endpoint returns the raw row — fold in summary stats from
        // the list endpoint so the page can show adoption/consents.
        const listRes = await fetch("/api/compliance/consent-policies", { cache: "no-store" });
        const listJson = await listRes.json();
        const summary = (listJson?.policies as Policy[] | undefined)?.find((p) => p.slug === version);
        const raw = json.policy as {
          id: string; version: string; slug: string; status: string;
          summary: string; sections: PolicySection[]; history: HistoryEntry[];
          scopeCategories: number; roleBindings: number;
          activatedAt: string | null; archivedAt: string | null; draftedAt: string;
        };
        setPolicy({
          ...raw,
          status: (raw.status === "active" || raw.status === "archived" || raw.status === "draft") ? raw.status : "draft",
          period: summary?.period ?? "",
          adoption: summary?.adoption ?? 0,
          consents: summary?.consents ?? 0,
          sections: Array.isArray(raw.sections) ? raw.sections : [],
          history: Array.isArray(raw.history) ? raw.history : [],
        });
      } catch (err) { console.error("[policy detail] fetch", err); setMissing(true); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [version, reloadKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading policy…
      </div>
    );
  }
  if (missing || !policy) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Link href="/compliance/consent-policies" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
            <ArrowLeft className="size-3.5" /> Consent policies
          </Link>
        </div>
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
          Policy not found in this tenant.
        </div>
      </div>
    );
  }

  const p = policy;
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/compliance/consent-policies" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Consent policies
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">Policy {p.version}</span>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-12 items-center justify-center rounded-xl font-mono text-base font-semibold ${
                p.status === "active"
                  ? "bg-[var(--color-primary)] text-white"
                  : p.status === "draft"
                    ? "bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]"
                    : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
              }`}
            >
              {p.version}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">Policy {p.version}</h1>
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
            {p.status !== "archived" && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/compliance/consent-policies/${p.slug}/edit`}>
                  <Edit /> Edit draft
                </Link>
              </Button>
            )}
            {p.status === "active" && (
              <ReConsentCampaignButton policyId={p.id} version={p.version} onDone={() => setReloadKey((k) => k + 1)} />
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-5 sm:grid-cols-3">
          <Stat label="Adoption" value={`${p.adoption}%`} />
          <Stat label="Active consents" value={p.consents.toLocaleString()} />
          <Stat label="Granular scopes" value={`${p.scopeCategories} categories · ${p.roleBindings} role bindings`} small />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <ScrollText className="size-4" /> Policy text · {p.version}
        </h2>
        <div className="mt-4 space-y-5">
          {p.sections.map((s, i) => (
            <section key={s.heading}>
              <h3 className="text-sm font-semibold">{i + 1}. {s.heading}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]">{s.body}</p>
            </section>
          ))}
        </div>
      </div>

      <div id="history" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 scroll-mt-24">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <History className="size-4" /> Version history
        </h2>
        {p.history.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">No history yet.</p>
        ) : (
          <ol className="mt-4 space-y-4 border-l border-[var(--color-border)] pl-5">
            {p.history.map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[1.42rem] top-1 size-2.5 rounded-full bg-[var(--color-primary)] ring-4 ring-[var(--color-card)]" />
                <p className="text-xs font-semibold text-[var(--color-muted-foreground)]">{h.date}</p>
                <p className="text-sm">{h.event}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

function ReConsentCampaignButton({ policyId, version, onDone }: { policyId: string; version: string; onDone: () => void }) {
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
      if (!res.ok || !json?.ok) { toast.error(json?.error ?? "Could not start campaign"); return; }
      toast.success("Re-consent campaign started", {
        description: `Bulk dispatch queued · ${(json.campaign?.recipientCount ?? 0).toLocaleString()} recipients · audit-logged`,
      });
      setOpen(false);
      onDone();
    } catch { toast.error("Network error"); }
    finally { setSubmitting(false); }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Megaphone /> Re-consent campaign
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

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${small ? "text-sm" : "text-2xl"}`}>{value}</p>
    </div>
  );
}
