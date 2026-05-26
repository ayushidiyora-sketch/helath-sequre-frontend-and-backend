import {
  Download,
  BarChart3,
  Calendar,
  Users,
  HardDrive,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ReportDownloadButton } from "@/components/shared/report-download-button";
import type { ReportKey } from "@/lib/report-generators";

const REPORTS: { key: ReportKey; name: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "appointment_summary", name: "Appointment summary", desc: "Volume per clinician, no-show breakdown", icon: Calendar },
  { key: "user_activity", name: "User activity", desc: "Logins, actions, MFA enrollment", icon: Users },
  { key: "audit_summary", name: "Storage & event summary", desc: "By bucket, by document category", icon: HardDrive },
  { key: "compliance_summary", name: "Department load", desc: "Utilization across 7 departments", icon: BarChart3 },
];

export default function AdminReports() {
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Operational reports"
        description="Org-scoped metrics. PHI access reports live in the Compliance Manager workspace."
        actions={
          <ReportDownloadButton report="appointment_summary" format="csv" size="sm">
            <Download /> Export CSV
          </ReportDownloadButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Appt completion", value: "94.2%", trend: "up", icon: Calendar },
          { label: "No-show rate", value: "3.8%", trend: "down", icon: Users },
          { label: "Storage growth", value: "+18 GB / mo", trend: "up", icon: HardDrive },
          { label: "User MAUs", value: "61 / 64", trend: "up", icon: Users },
        ].map((s) => {
          const Icon = s.icon;
          const TrendIcon = s.trend === "up" ? TrendingUp : TrendingDown;
          return (
            <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted-foreground)]">
                <span className="inline-flex items-center gap-1.5"><Icon className="size-3.5" /> {s.label}</span>
                <TrendIcon className={`size-3.5 ${s.trend === "up" ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`} />
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.name} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-all hover:shadow-[var(--shadow-card)]">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 text-base font-semibold">{r.name}</h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">{r.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant="muted" size="sm">Last run · 2h ago</Badge>
                <div className="flex gap-1">
                  <ReportDownloadButton report={r.key} format="pdf" variant="outline" size="sm">
                    Run · PDF
                  </ReportDownloadButton>
                  <ReportDownloadButton report={r.key} format="csv" variant="ghost" size="sm" aria-label="Download CSV">
                    <Download />
                  </ReportDownloadButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
