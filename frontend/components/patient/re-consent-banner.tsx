"use client";

import { useEffect, useState } from "react";
import { ScrollText, ShieldCheck, X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PendingResponse {
  responseId: string;
  campaignId: string;
  policyId: string;
  policyVersion: string;
  activatedAt: string | null;
  summary: string;
  sections: { heading: string; body: string }[];
  issuedAt: string;
}

/**
 * Gold banner card surfaced on the patient pages whenever Compliance has
 * dispatched a re-consent campaign for a new policy version and this patient
 * hasn't yet approved or declined. Fetches `/api/patient/re-consent` on mount;
 * silently renders nothing if there are no pending rows.
 */
export function ReConsentBanner() {
  const [pending, setPending] = useState<PendingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewOpen, setViewOpen] = useState<PendingResponse | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function reload() {
    try {
      const r = await fetch("/api/patient/re-consent", { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      if (!data?.ok) return;
      setPending(data.pending as PendingResponse[]);
    } catch (err) {
      console.error("[re-consent-banner] fetch", err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void reload(); }, []);

  async function respond(responseId: string, decision: "approved" | "declined") {
    setSubmitting(responseId);
    try {
      const r = await fetch("/api/patient/re-consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseId, decision }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) { toast.error(j?.error ?? "Could not record decision"); return; }
      // Optimistic — drop this row from the local list so the card disappears
      // instantly.
      setPending((curr) => curr.filter((p) => p.responseId !== responseId));
      setViewOpen(null);
      if (decision === "approved") {
        toast.success("New policy approved · audit-logged");
      } else {
        toast.warning("Policy declined · compliance team will follow up");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading || pending.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        {pending.map((p) => (
          <div
            key={p.responseId}
            className="overflow-hidden rounded-2xl border-2 border-[oklch(0.85_0.13_80)]/60 bg-gradient-to-r from-[oklch(0.95_0.05_85)] to-[oklch(0.96_0.04_75)] dark:from-[oklch(0.35_0.07_75)]/40 dark:to-[oklch(0.3_0.06_85)]/40 p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-card)] text-[oklch(0.45_0.14_75)] dark:text-[oklch(0.85_0.13_80)] ring-1 ring-[oklch(0.85_0.13_80)]/40">
                  <AlertTriangle className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center justify-center rounded-lg bg-[oklch(0.85_0.13_80)]/30 px-2 py-0.5 font-mono text-xs font-semibold text-[oklch(0.4_0.14_75)] dark:text-[oklch(0.9_0.13_80)]">
                      {p.policyVersion}
                    </span>
                    <h3 className="text-sm font-semibold">New consent policy — action required</h3>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    {p.activatedAt ? `Active since ${new Date(p.activatedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}` : "Activated recently"}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm">{p.summary}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewOpen(p)}>
                  <ScrollText /> View text
                </Button>
                <Button size="sm" disabled={submitting === p.responseId} onClick={() => respond(p.responseId, "approved")}>
                  {submitting === p.responseId ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck />}
                  Approve
                </Button>
                <Button variant="ghost" size="sm" disabled={submitting === p.responseId} onClick={() => respond(p.responseId, "declined")}
                  className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]">
                  <X /> Decline
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!viewOpen} onOpenChange={(v) => !v && setViewOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <ScrollText className="size-5" /> Policy {viewOpen?.policyVersion}
            </DialogTitle>
            <DialogDescription>{viewOpen?.summary}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pt-2">
            {viewOpen?.sections.map((s, i) => (
              <section key={s.heading}>
                <h3 className="text-sm font-semibold">{i + 1}. {s.heading}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]">{s.body}</p>
              </section>
            ))}
            {(!viewOpen?.sections || viewOpen.sections.length === 0) && (
              <p className="text-sm italic text-[var(--color-muted-foreground)]">No policy text recorded.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => viewOpen && respond(viewOpen.responseId, "declined")}
              disabled={!!submitting} className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]">
              <X /> Decline
            </Button>
            <Button onClick={() => viewOpen && respond(viewOpen.responseId, "approved")} disabled={!!submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck />}
              Approve policy {viewOpen?.policyVersion}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
