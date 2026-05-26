import { Download, ScrollText, ShieldCheck, FileBarChart2, Calendar, Mail, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ActionButton } from "@/components/shared/action-button";
import { ReportDownloadButton } from "@/components/shared/report-download-button";
import type { ReportKey } from "@/lib/report-generators";

const definitions: { key: ReportKey; name: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "compliance_summary", name: "Compliance summary", desc: "Posture score, anomalies, policy adoption", icon: ShieldCheck },
  { key: "access_report", name: "Access report", desc: "Who accessed which PHI when", icon: ScrollText },
  { key: "consent_compliance", name: "Consent compliance", desc: "Active / revoked / policy coverage", icon: ShieldCheck },
  { key: "audit_summary", name: "Audit summary", desc: "Event volume by category & status", icon: FileBarChart2 },
  { key: "user_activity", name: "User activity", desc: "Logins, actions, MFA changes", icon: FileBarChart2 },
  { key: "appointment_summary", name: "Appointment summary", desc: "Per-clinician volume & no-show rate", icon: Calendar },
];

const scheduled = [
  { name: "Weekly compliance digest", cadence: "Every Monday 7 AM", next: "May 19", recipients: ["compliance@…", "ceo@…"], status: "active" as const },
  { name: "Monthly access report", cadence: "1st of month", next: "Jun 1", recipients: ["compliance@…"], status: "active" as const },
  { name: "Quarterly anomaly review", cadence: "Q1, Q2, Q3, Q4", next: "Jul 1", recipients: ["compliance@…", "ciso@…"], status: "paused" as const },
];

export default function ComplianceReportsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Compliance reports"
        description="Generate on-demand or scheduled reports. Every export includes a cryptographic checksum manifest."
        actions={<SecurityBadge variant="audited" />}
      />

      <Tabs defaultValue="ondemand">
        <TabsList>
          <TabsTrigger value="ondemand">On-demand</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled · {scheduled.length}</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="ondemand">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {definitions.map((d) => {
              const Icon = d.icon;
              return (
                <div key={d.key} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-all hover:shadow-[var(--shadow-card)]">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-3 text-base font-semibold">{d.name}</h3>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{d.desc}</p>
                  <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                    <Badge variant="muted" size="sm">Last run · 4h ago</Badge>
                    <div className="flex gap-1.5">
                      <ReportDownloadButton report={d.key} format="pdf" variant="outline" size="sm">
                        <Download /> PDF
                      </ReportDownloadButton>
                      <ReportDownloadButton report={d.key} format="csv" variant="ghost" size="sm">
                        CSV
                      </ReportDownloadButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="scheduled">
          <div className="space-y-3">
            {scheduled.map((s) => (
              <div key={s.name} className="flex items-start gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-info-soft)] text-[var(--color-info)]">
                  <Calendar className="size-4.5" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{s.name}</h3>
                    {s.status === "active" ? <Badge variant="success" size="sm" dot>Active</Badge> : <Badge variant="warning" size="sm" dot>Paused</Badge>}
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{s.cadence} · next run {s.next}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--color-muted-foreground)]">
                    <Mail className="size-3" />
                    {s.recipients.map((r) => (
                      <span key={r} className="rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 font-mono">{r}</span>
                    ))}
                  </div>
                </div>
                <ActionButton variant="outline" size="sm" toastMessage={`Editing schedule · ${s.name}`} toastVariant="info">
                  Edit
                </ActionButton>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="archive">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <ul className="divide-y divide-[var(--color-border)]">
              {([
                { key: "compliance_summary", name: "Compliance summary · May 17", who: "Sai Compliance", checksum: "d4f1 · 9bb0" },
                { key: "access_report", name: "Access report · May 15", who: "Sai Compliance", checksum: "a91e · 3c44" },
                { key: "audit_summary", name: "Audit summary · Apr 30", who: "system (scheduled)", checksum: "11ab · 9912" },
              ] as { key: ReportKey; name: string; who: string; checksum: string }[]).map((a) => (
                <li key={a.name} className="flex items-center gap-3 p-4">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success)]">
                    <ScrollText className="size-4" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{a.name}</p>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">By {a.who} · checksum <span className="font-mono">{a.checksum}</span></p>
                  </div>
                  <ReportDownloadButton report={a.key} format="pdf" variant="outline" size="sm">
                    <Download /> PDF
                  </ReportDownloadButton>
                  <ActionButton variant="ghost" size="icon-sm" toastMessage={`Opening ${a.name}`} toastVariant="info" aria-label="Open report">
                    <ChevronRight />
                  </ActionButton>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
