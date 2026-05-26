import Link from "next/link";
import {
  ScrollText,
  ShieldCheck,
  FileBarChart2,
  Calendar,
  Users,
  HardDrive,
  BarChart3,
  Download,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReportDownloadButton } from "@/components/shared/report-download-button";
import type { ReportKey } from "@/lib/report-generators";
import { cn } from "@/lib/utils";

type DashboardReport = {
  key: ReportKey;
  name: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  lastRun: string;
  /** Hide CSV button (e.g. when CSV isn't useful for this report) */
  pdfOnly?: boolean;
  /** Mark report as fresh / new */
  badge?: "new" | "scheduled";
};

const COMPLIANCE_REPORTS: DashboardReport[] = [
  { key: "compliance_summary", name: "Compliance summary", desc: "Posture score, anomalies, policy adoption", icon: ShieldCheck, lastRun: "4h ago", badge: "new" },
  { key: "access_report", name: "PHI access report", desc: "Who accessed which PHI when", icon: ScrollText, lastRun: "4h ago" },
  { key: "consent_compliance", name: "Consent compliance", desc: "Active / revoked / policy coverage", icon: ShieldCheck, lastRun: "1d ago" },
  { key: "audit_summary", name: "Audit summary", desc: "Event volume by category & status", icon: FileBarChart2, lastRun: "12h ago" },
  { key: "user_activity", name: "User activity", desc: "Logins, actions, MFA enrollment", icon: Users, lastRun: "Yesterday" },
  { key: "appointment_summary", name: "Appointment summary", desc: "Per-clinician volume + no-show rate", icon: Calendar, lastRun: "Yesterday" },
];

const AUDITOR_REPORTS: DashboardReport[] = COMPLIANCE_REPORTS.filter((r) =>
  ["compliance_summary", "access_report", "consent_compliance", "audit_summary"].includes(r.key),
);

const ADMIN_REPORTS: DashboardReport[] = [
  { key: "appointment_summary", name: "Appointment summary", desc: "Volume per clinician, no-show breakdown", icon: Calendar, lastRun: "2h ago", badge: "new" },
  { key: "user_activity", name: "User activity", desc: "Logins, actions, MFA enrollment", icon: Users, lastRun: "Yesterday" },
  { key: "audit_summary", name: "Storage & event summary", desc: "By bucket, by document category", icon: HardDrive, lastRun: "2h ago", pdfOnly: true },
  { key: "compliance_summary", name: "Department load", desc: "Utilization across 7 departments", icon: BarChart3, lastRun: "12h ago", pdfOnly: true },
];

const PRESETS = {
  compliance: { items: COMPLIANCE_REPORTS, allHref: "/compliance/reports" },
  auditor: { items: AUDITOR_REPORTS, allHref: "/auditor/reports" },
  admin: { items: ADMIN_REPORTS, allHref: "/admin/reports" },
} as const;

export function ReportsWidget({
  preset = "compliance",
  className,
}: {
  preset?: keyof typeof PRESETS;
  className?: string;
}) {
  const { items, allHref } = PRESETS[preset];

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]", className)}>
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Quick reports</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            One-click PDF or CSV · every export embeds a checksum + is audit-logged
          </p>
        </div>
        <Link
          href={allHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-700)] hover:underline"
        >
          View all <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <ul className="grid gap-px bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => {
          const Icon = r.icon;
          return (
            <li
              key={r.key + r.name}
              className="flex flex-col gap-3 bg-[var(--color-card)] p-4 transition-colors hover:bg-[var(--color-muted)]/30"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    {r.badge === "new" && (
                      <Badge variant="success" size="sm" dot>New</Badge>
                    )}
                    {r.badge === "scheduled" && (
                      <Badge variant="info" size="sm">Scheduled</Badge>
                    )}
                  </div>
                  <p className="line-clamp-1 text-[11px] text-[var(--color-muted-foreground)]">
                    {r.desc}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-[var(--color-muted-foreground)]">
                  Last run · {r.lastRun}
                </span>
                <div className="flex gap-1.5">
                  <ReportDownloadButton report={r.key} format="pdf" variant="outline" size="sm">
                    <Download /> PDF
                  </ReportDownloadButton>
                  {!r.pdfOnly && (
                    <ReportDownloadButton report={r.key} format="csv" variant="ghost" size="sm">
                      CSV
                    </ReportDownloadButton>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-muted)]/30 px-5 py-3 text-[11px] text-[var(--color-muted-foreground)]">
        <span>{items.length} reports · ready to export</span>
        <Link
          href={allHref}
          className="font-medium text-[var(--color-primary-700)] hover:underline"
        >
          Schedule + archive →
        </Link>
      </div>
    </div>
  );
}
