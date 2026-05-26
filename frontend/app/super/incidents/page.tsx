import { CheckCircle2, ShieldAlert, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionButton } from "@/components/shared/action-button";
import { OpenIncidentDialog } from "./open-incident-dialog";

const active = [
  { id: "INC-0021", title: "GreenLeaf · suspected unauthorized PHI access", sev: "high" as const, opened: "2h ago", commander: "Riya Sen", status: "investigating" },
  { id: "INC-0022", title: "EU email-delivery latency", sev: "minor" as const, opened: "1h ago", commander: "Auto · runbook engaged", status: "mitigating" },
];

const closed = [
  { id: "INC-0020", title: "ap-south-1 worker 502 spike", sev: "minor" as const, time: "May 16 · 2h 14m", resolution: "Worker scale-out" },
  { id: "INC-0019", title: "S3 list latency spike", sev: "minor" as const, time: "May 14 · 38m", resolution: "AWS-side recovery" },
  { id: "INC-0018", title: "Brute-force on org_acme", sev: "high" as const, time: "May 12 · 1h 02m", resolution: "WAF rule + IP block" },
];

export default function IncidentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Incidents"
        description="Lifecycle: open → investigating → mitigating → monitoring → resolved. Each step is audit-logged."
        actions={<OpenIncidentDialog />}
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active · {active.length}</TabsTrigger>
          <TabsTrigger value="closed">Closed · {closed.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <div className="space-y-4">
            {active.map((i) => (
              <div key={i.id} className={`overflow-hidden rounded-2xl border p-5 ${i.sev === "high" ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20" : "border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/20"}`}>
                <div className="flex flex-wrap items-start gap-4">
                  <span className={`flex size-11 items-center justify-center rounded-xl ${i.sev === "high" ? "bg-[var(--color-card)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/30" : "bg-[var(--color-card)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)] ring-1 ring-[var(--color-warning)]/30"}`}>
                    <ShieldAlert className="size-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs">{i.id}</p>
                      <h3 className="text-base font-semibold">{i.title}</h3>
                      {i.sev === "high" ? <Badge variant="danger" size="sm" dot>High</Badge> : <Badge variant="warning" size="sm" dot>Minor</Badge>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
                      <span className="inline-flex items-center gap-1"><Clock className="size-3" /> Opened {i.opened}</span>
                      <span className="inline-flex items-center gap-1"><Users className="size-3" /> {i.commander}</span>
                      <Badge variant="info" size="sm" dot>{i.status}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <ActionButton variant="outline" size="sm" toastMessage={`Runbook for ${i.id} opened`} toastVariant="info">
                      Open runbook
                    </ActionButton>
                    <ActionButton size="sm" toastMessage={`${i.id} status updated`} toastDescription="Stakeholders notified">
                      Update status
                    </ActionButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="closed">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <ul className="divide-y divide-[var(--color-border)]">
              {closed.map((i) => (
                <li key={i.id} className="flex items-center gap-3 p-4">
                  <CheckCircle2 className="size-5 text-[var(--color-success)]" />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-mono text-xs mr-2 text-[var(--color-muted-foreground)]">{i.id}</span>
                      <span className="font-semibold">{i.title}</span>
                    </p>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">Duration {i.time} · {i.resolution}</p>
                  </div>
                  {i.sev === "high" ? <Badge variant="danger" size="sm">High · resolved</Badge> : <Badge variant="muted" size="sm">Resolved</Badge>}
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
