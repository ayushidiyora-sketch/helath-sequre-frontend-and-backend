import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, Send, History, ScrollText, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { POLICIES, getPolicy } from "../consent-policies-data";
import { CAMPAIGNS } from "../../campaigns/campaigns-data";

export function generateStaticParams() {
  return POLICIES.map((p) => ({ version: p.slug }));
}

export default async function PolicyVersionPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const p = getPolicy(version);
  if (!p) notFound();
  const campaign = CAMPAIGNS.find((c) => c.policySlug === p.slug);

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/compliance/consent-policies"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Consent policies
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">Policy {p.version}</span>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-12 items-center justify-center rounded-xl font-mono text-base font-semibold ${
                p.status === "active"
                  ? "bg-[var(--color-primary)] text-white"
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
            <Button asChild variant="outline" size="sm">
              <Link href={`/compliance/consent-policies/${p.slug}/edit`}>
                <Edit /> Edit draft
              </Link>
            </Button>
            {p.status === "active" && campaign && (
              <Button asChild size="sm">
                <Link href={`/compliance/campaigns/${campaign.id}`}>
                  <Megaphone /> View re-consent campaign
                </Link>
              </Button>
            )}
            {p.status === "active" && !campaign && (
              <ActionButton
                size="sm"
                confirm={{
                  title: "Trigger re-consent campaign?",
                  description: `Bulk email + in-app notice will go to patients still on prior policy versions.`,
                  confirmLabel: "Send campaign",
                }}
                toastMessage="Re-consent campaign started"
                toastDescription={`Bulk dispatch queued · ${p.consents.toLocaleString()} recipients`}
              >
                <Send /> Re-consent campaign
              </ActionButton>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-5 sm:grid-cols-3">
          <Stat label="Adoption" value={`${p.adoption}%`} />
          <Stat label="Active consents" value={p.consents.toLocaleString()} />
          <Stat label="Granular scopes" value={`${p.scopeCategories} categories · ${p.roleBindings} role bindings`} small />
        </div>
      </div>

      {/* Policy text */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <ScrollText className="size-4" /> Policy text · {p.version}
        </h2>
        <div className="mt-4 space-y-5">
          {p.sections.map((s, i) => (
            <section key={s.heading}>
              <h3 className="text-sm font-semibold">
                {i + 1}. {s.heading}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]">{s.body}</p>
            </section>
          ))}
        </div>
      </div>

      {/* Version history */}
      <div id="history" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 scroll-mt-24">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <History className="size-4" /> Version history
        </h2>
        <ol className="mt-4 space-y-4 border-l border-[var(--color-border)] pl-5">
          {p.history.map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[1.42rem] top-1 size-2.5 rounded-full bg-[var(--color-primary)] ring-4 ring-[var(--color-card)]" />
              <p className="text-xs font-semibold text-[var(--color-muted-foreground)]">{h.date}</p>
              <p className="text-sm">{h.event}</p>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className={`mt-1 font-semibold tabular-nums ${small ? "text-sm" : "text-2xl"}`}>{value}</p>
    </div>
  );
}
