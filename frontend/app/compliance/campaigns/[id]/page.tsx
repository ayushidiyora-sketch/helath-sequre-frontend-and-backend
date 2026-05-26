import Link from "next/link";
import { notFound } from "next/navigation";
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
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ActionButton } from "@/components/shared/action-button";
import {
  CAMPAIGNS,
  campaignProgress,
  getCampaign,
  type Channel,
} from "../campaigns-data";

const CHANNEL_META: Record<Channel, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  email: { label: "Email", icon: Mail },
  in_app: { label: "In-app banner", icon: Bell },
  sms: { label: "SMS", icon: Smartphone },
};

export function generateStaticParams() {
  return CAMPAIGNS.map((c) => ({ id: c.id }));
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = getCampaign(id);
  if (!c) notFound();

  const { reconsented, pct, remaining } = campaignProgress(c);
  const active = c.status === "active";
  const maxDaily = Math.max(...c.daily.map((d) => d.reconsented));

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/compliance/campaigns"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Re-consent campaigns
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">Policy {c.policyVersion}</span>
      </div>

      {/* Header */}
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
                <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> Started {c.startedAt}</span>
                <span className="inline-flex items-center gap-1"><Users className="size-3" /> {c.targetCount.toLocaleString()} patients</span>
                <Link
                  href={`/compliance/consent-policies/${c.policySlug}`}
                  className="inline-flex items-center gap-1 underline-offset-2 hover:text-[var(--color-foreground)] hover:underline"
                >
                  <ScrollText className="size-3" /> View policy {c.policyVersion}
                </Link>
              </div>
            </div>
          </div>
          {active && (
            <div className="flex flex-wrap gap-2">
              <ActionButton
                variant="outline"
                size="sm"
                confirm={{
                  title: "Send a final reminder?",
                  description: `${remaining.toLocaleString()} patients haven't re-consented. A final reminder will be dispatched on their active channel.`,
                  confirmLabel: "Send reminder",
                }}
                toastMessage="Final reminder dispatched"
                toastDescription={`${remaining.toLocaleString()} patients · email + SMS · audit-logged`}
              >
                Send final reminder
              </ActionButton>
              <ActionButton
                size="sm"
                confirm={{
                  title: "Mark campaign as complete?",
                  description: "Closing the campaign stops further reminders. Remaining patients will re-consent at next login.",
                  confirmLabel: "Mark complete",
                  variant: "destructive",
                }}
                href="/compliance/campaigns"
                toastMessage="Campaign marked complete"
                toastDescription={`Policy ${c.policyVersion} · ${pct}% adoption · audit-logged`}
              >
                <CheckCircle2 /> Mark complete
              </ActionButton>
            </div>
          )}
        </div>

        {/* Headline progress */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Stat icon={Users} label="Re-consented" value={`${reconsented.toLocaleString()} / ${c.targetCount.toLocaleString()}`} sub={`${pct}%`} />
          <Stat icon={Clock} label="Remaining" value={remaining.toLocaleString()} sub={active ? "Reminders ongoing" : "Closed"} />
          <Stat icon={TrendingUp} label="Last activity" value={c.daily[c.daily.length - 1].date} sub={`+${c.daily[c.daily.length - 1].reconsented} re-consents`} />
        </div>

        <div className="mt-4">
          <Progress value={pct} />
        </div>
      </div>

      {/* Day-by-day chart */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Re-consents per checkpoint</h2>
            <p className="text-xs text-[var(--color-muted-foreground)]">Daily uptake from the initial notification through reminders.</p>
          </div>
          <Badge variant="info" size="sm" dot>{c.daily.length} checkpoints</Badge>
        </div>
        <div className="mt-6 flex items-end gap-2 h-44">
          {c.daily.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-[var(--color-primary)] to-[oklch(0.62_0.12_185)]"
                  style={{ height: `${Math.max(2, (d.reconsented / maxDaily) * 100)}%` }}
                  title={`${d.reconsented} re-consents on ${d.date}`}
                />
              </div>
              <p className="text-[10px] font-mono tabular-nums text-[var(--color-muted-foreground)]">{d.date}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 text-[11px] text-[var(--color-muted-foreground)] sm:grid-cols-2">
          {c.daily.map((d) => (
            <div key={d.day} className="flex items-center justify-between rounded-md bg-[var(--color-muted)]/30 px-2.5 py-1">
              <span>Day {d.day} · {d.date}</span>
              <span className="font-mono tabular-nums">+{d.reconsented} · {Math.round((d.cumulative / c.targetCount) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Channels & schedule */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="text-sm font-semibold">Channels & schedule</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {c.channels.map((ch) => {
              const meta = CHANNEL_META[ch];
              const Icon = meta.icon;
              return (
                <span key={ch} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-2.5 py-1 text-[11px]">
                  <Icon className="size-3.5" /> {meta.label}
                </span>
              );
            })}
          </div>
          <ul className="mt-4 space-y-2">
            {c.reminderSchedule.map((step) => (
              <li key={step} className="flex items-start gap-2.5 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
                <span className="text-[var(--color-muted-foreground)]">{step}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
            <p className="font-medium text-[var(--color-foreground)]">Notification template</p>
            <p className="mt-1 italic">{c.template}</p>
          </div>
        </div>

        {/* Remaining bucket breakdown */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="text-sm font-semibold">Remaining patients</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Bucketed by why they haven't re-consented yet.</p>
          {c.remainingBuckets.length === 0 ? (
            <p className="mt-4 rounded-lg bg-[var(--color-success-soft)]/40 p-3 text-sm text-[var(--color-success)]">
              <CheckCircle2 className="mr-1 inline size-4" /> Everyone has re-consented or aged out.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {c.remainingBuckets.map((b) => (
                <li key={b.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{b.label}</p>
                    <Badge variant="warning" size="sm">{b.count}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">{b.hint}</p>
                </li>
              ))}
            </ul>
          )}
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
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
      <p className="text-[11px] text-[var(--color-muted-foreground)]">{sub}</p>
    </div>
  );
}
