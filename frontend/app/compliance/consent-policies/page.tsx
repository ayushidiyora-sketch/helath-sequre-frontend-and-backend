import Link from "next/link";
import { Plus, ScrollText, Edit, History, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/shared/action-button";
import { POLICIES } from "./consent-policies-data";

export default function ComplianceConsentPolicies() {
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
        {POLICIES.map((p) => (
          <div key={p.version} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] p-5">
              <div className="flex items-start gap-3">
                <span className={`flex size-12 items-center justify-center rounded-xl text-base font-mono font-semibold ${p.status === "active" ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"}`}>
                  {p.version}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">Policy {p.version}</h3>
                    {p.status === "active" ? (
                      <Badge variant="success" size="sm" dot>Active</Badge>
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
                {p.status === "active" ? (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/compliance/consent-policies/${p.slug}/edit`}>
                        <Edit /> Edit draft
                      </Link>
                    </Button>
                    <ActionButton
                      size="sm"
                      confirm={{
                        title: "Trigger re-consent campaign?",
                        description: `Bulk email + in-app notice will go to ${p.consents} patients still on prior policy versions.`,
                        confirmLabel: "Send campaign",
                      }}
                      toastMessage="Re-consent campaign started"
                      toastDescription={`Bulk dispatch queued · ${p.consents} recipients`}
                    >
                      <Send /> Re-consent campaign
                    </ActionButton>
                  </>
                ) : (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/compliance/consent-policies/${p.slug}#history`}>
                      <History /> Version history
                    </Link>
                  </Button>
                )}
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
        ))}
      </div>
    </>
  );
}
