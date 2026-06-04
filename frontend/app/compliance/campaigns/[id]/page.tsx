"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Megaphone,
  Mail,
  Smartphone,
  Bell,
  Calendar,
  Users,
  Clock,
  ScrollText,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type Channel = "email" | "in_app" | "sms";

interface Campaign {
  id: string;
  policyId: string;
  policyVersion: string;
  status: string;
  triggeredAt: string;
  completedAt: string | null;
  activatedAt: string | null;
  target: number;
  approved: number;
  declined: number;
  pending: number;
  responded: number;
  remaining: number;
  pct: number;
  channels: Channel[];
}

const CHANNEL_META: Record<Channel, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  email: { label: "Email", icon: Mail },
  in_app: { label: "In-app banner", icon: Bell },
  sms: { label: "SMS", icon: Smartphone },
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/compliance/re-consent-campaigns", { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok || !j?.ok) { setMissing(true); return; }
        const found = (j.campaigns as Campaign[]).find((c) => c.id === id);
        if (!found) { setMissing(true); return; }
        setCampaign(found);
      } catch (err) {
        console.error("[campaign detail] fetch", err);
        setMissing(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading campaign…
      </div>
    );
  }
  if (missing || !campaign) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Link href="/compliance/campaigns" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
            <ArrowLeft className="size-3.5" /> Re-consent campaigns
          </Link>
        </div>
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
          Campaign not found.
        </div>
      </div>
    );
  }

  const c = campaign;
  const active = c.status !== "completed";

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/compliance/campaigns" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Re-consent campaigns
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">Policy {c.policyVersion}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[var(--color-primary-50)]/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-card)] text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary)]/20">
              <Megaphone className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">Policy {c.policyVersion} re-consent campaign</h1>
                {active ? (
                  <Badge variant="info" size="sm" dot>Active</Badge>
                ) : (
                  <Badge variant="success" size="sm" dot>Completed</Badge>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
                <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> Started {dateLabel(c.triggeredAt)}</span>
                <span className="inline-flex items-center gap-1"><Users className="size-3" /> {c.target.toLocaleString()} patients</span>
                <Link
                  href="/compliance/consent-policies"
                  className="inline-flex items-center gap-1 underline-offset-2 hover:text-[var(--color-foreground)] hover:underline"
                >
                  <ScrollText className="size-3" /> View policy {c.policyVersion}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Stat icon={Users} label="Re-consented" value={`${c.approved.toLocaleString()} / ${c.target.toLocaleString()}`} sub={`${c.pct}%`} />
          <Stat icon={Clock} label="Pending" value={c.pending.toLocaleString()} sub={active ? "Awaiting response" : "Closed"} />
          <Stat icon={CheckCircle2} label="Declined" value={c.declined.toLocaleString()} sub={c.declined === 0 ? "No declines" : "Compliance to follow up"} />
        </div>

        <div className="mt-4">
          <Progress value={c.pct} />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-semibold">Notification channels</h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Patients are notified on these channels until they respond.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {c.channels.map((ch) => {
            const meta = CHANNEL_META[ch];
            const Icon = meta.icon;
            return (
              <span key={ch} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-3 py-1 text-xs">
                <Icon className="size-3.5" /> {meta.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-semibold">Response breakdown</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--color-border)]">
              <Row label="Approved (re-consented)" value={c.approved.toLocaleString()} accent="success" />
              <Row label="Declined" value={c.declined.toLocaleString()} accent={c.declined > 0 ? "danger" : "muted"} />
              <Row label="Pending response" value={c.pending.toLocaleString()} accent="warning" />
              <Row label="Total recipients" value={c.target.toLocaleString()} accent="muted" />
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <Icon className="size-3" /> {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-[var(--color-muted-foreground)]">{sub}</p>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent: "success" | "danger" | "warning" | "muted" }) {
  const cls = accent === "success" ? "text-[var(--color-success)]"
    : accent === "danger" ? "text-[var(--color-danger)]"
    : accent === "warning" ? "text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]"
    : "text-[var(--color-foreground)]";
  return (
    <tr>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{label}</td>
      <td className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${cls}`}>{value}</td>
    </tr>
  );
}
