"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  Mail,
  Smartphone,
  Bell,
  ArrowRight,
  CheckCircle2,
  Users,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";

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
  in_app: { label: "In-app", icon: Bell },
  sms: { label: "SMS", icon: Smartphone },
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/compliance/re-consent-campaigns", { cache: "no-store" });
        const j = await r.json();
        if (!alive || !j?.ok) return;
        setCampaigns(j.campaigns as Campaign[]);
      } catch (err) {
        console.error("[campaigns] fetch", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const active = campaigns.filter((c) => c.status !== "completed");
  const completed = campaigns.filter((c) => c.status === "completed");

  return (
    <>
      <PageHeader
        eyebrow="Re-consent campaigns"
        title="Policy version uptake"
        description="A campaign launches when a new policy version is activated. Patients on the prior version are notified and asked to re-grant consent through their preferred channel."
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active · {active.length}</TabsTrigger>
          <TabsTrigger value="completed">Completed · {completed.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {loading ? (
            <LoadingBlock />
          ) : active.length === 0 ? (
            <EmptyBlock message="No active campaigns. Activating a new policy version automatically launches one." />
          ) : (
            <div className="space-y-4">
              {active.map((c) => <CampaignRow key={c.id} c={c} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {loading ? (
            <LoadingBlock />
          ) : completed.length === 0 ? (
            <EmptyBlock message="No completed campaigns yet." />
          ) : (
            <div className="space-y-4">
              {completed.map((c) => <CampaignRow key={c.id} c={c} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function CampaignRow({ c }: { c: Campaign }) {
  const done = c.status === "completed";
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`flex size-11 items-center justify-center rounded-xl ring-1 ${done ? "bg-[var(--color-success-soft)] text-[var(--color-success)] ring-[var(--color-success)]/30" : "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-[var(--color-primary)]/20"}`}>
            {done ? <CheckCircle2 className="size-5" /> : <Megaphone className="size-5" />}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">Policy {c.policyVersion} re-consent</h3>
              {done ? (
                <Badge variant="success" size="sm" dot>Completed</Badge>
              ) : (
                <Badge variant="info" size="sm" dot>Active</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Started {dateLabel(c.triggeredAt)} · {c.target.toLocaleString()} patient{c.target === 1 ? "" : "s"} targeted
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {c.channels.map((ch) => {
                const meta = CHANNEL_META[ch];
                const Icon = meta.icon;
                return (
                  <span key={ch} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-2 py-0.5 text-[11px]">
                    <Icon className="size-3" /> {meta.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <Button asChild size="sm" variant={done ? "outline" : "default"}>
          <Link href={`/compliance/campaigns/${c.id}`}>View progress <ArrowRight /></Link>
        </Button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 font-medium">
              <Users className="size-3.5" /> {c.approved.toLocaleString()} re-consented
              {c.declined > 0 && (
                <span className="ml-2 text-[var(--color-danger)]">· {c.declined} declined</span>
              )}
            </span>
            <span className="font-mono tabular-nums">{c.pct}%</span>
          </div>
          <Progress value={c.pct} />
        </div>
        <p className="text-[11px] text-[var(--color-muted-foreground)] sm:min-w-[140px] sm:text-right">
          {c.remaining.toLocaleString()} remaining
        </p>
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
      <Loader2 className="mr-2 size-4 animate-spin" /> Loading campaigns…
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
      {message}
    </div>
  );
}
