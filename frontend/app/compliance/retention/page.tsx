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

      <PurgeRunsPanel />
    </>
  );
}

function PurgeRunsPanel() {
  const runs = [
    {
      id: "purge-2026-05-26",
      date: "May 26, 2026 · 02:00 UTC",
      result: "success" as const,
      records: 1248,
      bytes: "412 MB",
      categories: ["Documents", "Messages"],
      duration: "4m 12s",
    },
    {
      id: "purge-2026-05-25",
      date: "May 25, 2026 · 02:00 UTC",
      result: "success" as const,
      records: 1109,
      bytes: "388 MB",
      categories: ["Documents", "Messages"],
      duration: "3m 51s",
    },
    {
      id: "purge-2026-05-24",
      date: "May 24, 2026 · 02:00 UTC",
      result: "partial" as const,
      records: 802,
      bytes: "266 MB",
      categories: ["Documents"],
      duration: "5m 02s",
      note: "Messages category skipped — legal hold #LH-0042 blocks 41 threads",
    },
  ];

  const next = "May 27, 2026 · 02:00 UTC";

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Retention enforcement</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Daily purge job · runs at 02:00 UTC · honors active legal holds
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-3 py-1 text-[11px] font-medium">
            <Clock className="size-3" /> Next run · {next}
          </span>
          <ActionButton
            size="sm"
            variant="outline"
            confirm={{
              title: "Run purge job now?",
              description: "Off-cycle purges are heavily audited. Legal holds are honored. Continue?",
              confirmLabel: "Run now",
              variant: "destructive",
            }}
            toastMessage="Purge job queued"
            toastDescription="Off-cycle run · audit-logged · est. completion in 5 min"
          >
            <Trash2 /> Run purge now
          </ActionButton>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-[var(--color-muted)]/40 text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Run</th>
              <th className="px-4 py-2.5 text-left font-semibold">Result</th>
              <th className="px-4 py-2.5 text-left font-semibold">Records purged</th>
              <th className="px-4 py-2.5 text-left font-semibold">Categories</th>
              <th className="px-4 py-2.5 text-left font-semibold">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {runs.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs">{r.id}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{r.date}</p>
                </td>
                <td className="px-4 py-3">
                  {r.result === "success" ? (
                    <Badge variant="success" size="sm" dot>Success</Badge>
                  ) : (
                    <Badge variant="warning" size="sm" dot>Partial</Badge>
                  )}
                  {r.note && (
                    <p className="mt-1 max-w-xs text-[10px] italic text-[var(--color-muted-foreground)]">
                      {r.note}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {r.records.toLocaleString()} · {r.bytes}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.categories.map((c) => (
                      <Badge key={c} variant="muted" size="sm">{c}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                  {r.duration}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-[var(--color-muted-foreground)]">
        Soft-deleted items hit the purge job after their category retention window lapses. Legal-hold flagged items
        skip the run and resurface on the next eligible day.
      </p>
    </div>
  );
}
