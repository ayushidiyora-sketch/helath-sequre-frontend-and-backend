import Link from "next/link";
import { Database, Clock, AlertTriangle, Trash2, Edit, ArrowRight, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ActionButton } from "@/components/shared/action-button";
import { DELETION_REQUESTS } from "../deletion-requests/deletion-requests-data";

const buckets = [
  { name: "Medical records", retention: "7 years", deletion: "Scheduled", count: "4,128 patients" },
  { name: "Documents", retention: "5 years", deletion: "Scheduled", count: "21,648 files" },
  { name: "Messages", retention: "2 years", deletion: "Scheduled", count: "186k threads" },
  { name: "Audit logs", retention: "6 years", deletion: "Cold-tier after 2y", count: "8.4M events" },
  { name: "Backups", retention: "30 days PITR", deletion: "Rolling", count: "Daily full" },
];

const recentRequests = DELETION_REQUESTS.slice(0, 3);

export default function RetentionPage() {
  return (
    <>
      <PageHeader
        eyebrow="Data retention"
        title="Lifecycle & right-of-access"
        description="Set tenant retention windows, manage scheduled purges, and approve patient export / deletion requests."
        actions={<SecurityBadge variant="audited" />}
      />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-semibold">Retention windows</h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">Per-category retention configured by Compliance Manager. HIPAA enforces a 6-year minimum on audit logs.</p>
        <div className="mt-4 space-y-2">
          {buckets.map((b) => (
            <div key={b.name} className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] p-4">
              <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                <Database className="size-4.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{b.name}</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{b.count} · purge {b.deletion.toLowerCase()}</p>
              </div>
              <Badge variant="muted" size="sm"><Clock /> {b.retention}</Badge>
              <ActionButton variant="ghost" size="sm" toastMessage={`Adjusting retention for ${b.name}`} toastVariant="info">
                <Edit /> Adjust
              </ActionButton>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Patient data requests</h2>
              <p className="text-xs text-[var(--color-muted-foreground)]">HIPAA right-of-access · GDPR right-to-be-forgotten</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/compliance/deletion-requests">Open queue <ArrowRight /></Link>
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {recentRequests.map((r) => (
              <Link
                key={r.id}
                href={`/compliance/deletion-requests/${r.id}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-muted)]/40"
              >
                <span className={`flex size-9 items-center justify-center rounded-lg ${r.type === "export" ? "bg-[var(--color-info-soft)] text-[var(--color-info)]" : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"}`}>
                  {r.type === "export" ? <Download className="size-4" /> : <Trash2 className="size-4" />}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.patientName} · {r.type === "export" ? "Export" : "Deletion"}</p>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">{r.patientMrn} · {r.requestedAt.split(" · ")[0]}</p>
                </div>
                {r.status === "in_progress" && <Badge variant="info" size="sm" dot>In progress</Badge>}
                {r.status === "pending" && <Badge variant="warning" size="sm" dot>Pending</Badge>}
                {r.status === "approved_partial" && <Badge variant="success" size="sm" dot>Partial</Badge>}
                {r.status === "approved_full" && <Badge variant="success" size="sm" dot>Approved</Badge>}
                {r.status === "blocked" && <Badge variant="danger" size="sm" dot>Legal hold</Badge>}
                {r.status === "rejected" && <Badge variant="muted" size="sm">Rejected</Badge>}
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="text-sm font-semibold">Override controls</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Overrides require justification and are audit-logged as high-sensitivity events.</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3">
              <div>
                <p className="text-sm font-medium">Pause scheduled purge</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">Use only during investigations</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3">
              <div>
                <p className="text-sm font-medium">Block deletion (legal hold)</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">Auto-applied to litigation cases</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[var(--color-warning-soft)]/30 p-3 text-xs text-[var(--color-muted-foreground)]">
            <AlertTriangle className="mr-1 inline-block size-3.5 text-[var(--color-warning)]" />
            Last override: <span className="text-[var(--color-foreground)] font-medium">May 5, by Sai Compliance</span> · investigation #INC-0014
          </div>
        </div>
      </div>
    </>
  );
}
