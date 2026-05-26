import { Download, ScrollText, ShieldCheck, FileBarChart2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ReportDownloadButton } from "@/components/shared/report-download-button";
import type { ReportKey } from "@/lib/report-generators";

const reports: { key: ReportKey; name: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "compliance_summary", name: "Compliance summary", desc: "Posture, anomalies, policy adoption", icon: ShieldCheck },
  { key: "access_report", name: "Access report", desc: "Who accessed which PHI when", icon: ScrollText },
  { key: "consent_compliance", name: "Consent compliance", desc: "Active / revoked / policy coverage", icon: ShieldCheck },
  { key: "audit_summary", name: "Audit summary", desc: "Event volume by category & status", icon: FileBarChart2 },
];

export default function AuditorReports() {
  return (
    <>
      <PageHeader
        eyebrow="Reports · export-only"
        title="Compliance reports"
        description="You can view and export. Scheduling, editing, and definition changes are reserved for the Compliance Manager."
        actions={
          <>
            <SecurityBadge variant="audited" />
            <Badge variant="muted" size="sm"><Lock className="size-3" /> Read-only</Badge>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.key} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 text-base font-semibold">{r.name}</h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">{r.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant="muted" size="sm">Last run 4h ago</Badge>
                <div className="flex gap-1">
                  <ReportDownloadButton report={r.key} format="pdf" variant="outline" size="sm">
                    <Download /> PDF
                  </ReportDownloadButton>
                  <ReportDownloadButton report={r.key} format="csv" variant="outline" size="sm">
                    <Download /> CSV
                  </ReportDownloadButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--color-info)]/30 bg-[var(--color-info-soft)]/30 p-4 text-xs text-[var(--color-muted-foreground)]">
        Exports embed a SHA-256 manifest so you can prove evidence integrity later. The export itself is audit-logged.
      </div>
    </>
  );
}
