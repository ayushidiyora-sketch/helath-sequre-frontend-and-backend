import Link from "next/link";
import {
  Megaphone,
  Mail,
  Smartphone,
  Bell,
  ArrowRight,
  CheckCircle2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import {
  CAMPAIGNS,
  campaignProgress,
  type Campaign,
  type Channel,
} from "./campaigns-data";

const CHANNEL_META: Record<Channel, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  email: { label: "Email", icon: Mail },
  in_app: { label: "In-app", icon: Bell },
  sms: { label: "SMS", icon: Smartphone },
};

export default function CampaignsPage() {
  const active = CAMPAIGNS.filter((c) => c.status === "active");
  const completed = CAMPAIGNS.filter((c) => c.status === "completed");

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
          <div className="space-y-4">
            {active.map((c) => <CampaignRow key={c.id} c={c} />)}
          </div>
        </TabsContent>

        <TabsContent value="completed">
          <div className="space-y-4">
            {completed.map((c) => <CampaignRow key={c.id} c={c} />)}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function CampaignRow({ c }: { c: Campaign }) {
  const { reconsented, pct, remaining } = campaignProgress(c);
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
              Started {c.startedAt} · {c.targetCount.toLocaleString()} patients targeted
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
            <span className="inline-flex items-center gap-1 font-medium"><Users className="size-3.5" /> {reconsented.toLocaleString()} re-consented</span>
            <span className="font-mono tabular-nums">{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>
        <p className="text-[11px] text-[var(--color-muted-foreground)] sm:min-w-[140px] sm:text-right">
          {remaining.toLocaleString()} remaining
        </p>
      </div>
    </div>
  );
}
