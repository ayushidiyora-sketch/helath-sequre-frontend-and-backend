import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Shield,
  CheckCircle2,
  ScrollText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/shared/action-button";
import { OPEN_ANOMALIES, CLOSED_ANOMALIES } from "./anomalies-data";
import { ResolveAnomalyButton } from "./resolve-anomaly";

export default function AnomaliesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Anomalies"
        title="Behavioral exceptions"
        description="Surfaced by the anomaly engine. Each open item requires your decision to dismiss, escalate, or open an incident."
      />

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open · {OPEN_ANOMALIES.length}</TabsTrigger>
          <TabsTrigger value="closed">Closed · {CLOSED_ANOMALIES.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <div className="space-y-4">
            {OPEN_ANOMALIES.map((a) => (
              <div key={a.id} className={`overflow-hidden rounded-2xl border p-5 ${a.sev === "high" ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20" : "border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/20"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className={`flex size-10 items-center justify-center rounded-xl ${a.sev === "high" ? "bg-[var(--color-card)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/30" : "bg-[var(--color-card)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)] ring-1 ring-[var(--color-warning)]/30"}`}>
                      <AlertTriangle className="size-5" />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{a.title}</h3>
                        {a.sev === "high" ? <Badge variant="danger" size="sm" dot>High</Badge> : <Badge variant="warning" size="sm" dot>Medium</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{a.description}</p>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
                        <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {a.time}</span>
                        <span className="inline-flex items-center gap-1"><ScrollText className="size-3" /> {a.events} events</span>
                        <span className="inline-flex items-center gap-1"><Shield className="size-3" /> Anomaly engine v2</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm">
                      <Link href={`/compliance/anomalies/${a.id}`}>Investigate</Link>
                    </Button>
                    <ActionButton variant="outline" size="sm" href="/compliance/audit-logs" toastMessage={`Filtering ledger to ${a.events} events`} toastVariant="info">
                      View events
                    </ActionButton>
                    <ResolveAnomalyButton anomalyId={a.id} label="Resolve…" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="closed">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <ul className="divide-y divide-[var(--color-border)]">
              {CLOSED_ANOMALIES.map((c, i) => (
                <li key={i} className="flex items-start gap-3 p-4">
                  <CheckCircle2 className="mt-0.5 size-5 text-[var(--color-success)]" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{c.title}</p>
                      <Badge variant="success" size="sm">{c.outcome}</Badge>
                    </div>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">By {c.reviewer} · {c.date}</p>
                    <p className="mt-1 text-[11px] italic text-[var(--color-muted-foreground)]/90">{c.justification}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
