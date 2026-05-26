import {
  Eye,
  ScrollText,
  Shield,
  FileBarChart2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Clock,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ActionButton } from "@/components/shared/action-button";
import { ReportsWidget } from "@/components/shared/reports-widget";

export default function AuditorDashboard() {
  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[oklch(0.96_0.025_250)] p-6 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gradient-to-br from-[oklch(0.65_0.08_250)] to-transparent opacity-20 blur-3xl" />
        <div className="relative grid gap-5 sm:grid-cols-[1.4fr_1fr] sm:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted-foreground)]">
              <Eye className="size-3" /> Strictly read-only · session bounded
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Auditor overview · City General
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-[var(--color-muted-foreground)]">
              Audit window: <span className="font-medium text-[var(--color-foreground)]">May 1 – May 18, 2026</span>.
              Your account expires automatically on <span className="font-medium text-[var(--color-foreground)]">Jun 1, 2026</span>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton size="sm" href="/auditor/audit-logs">
                <ScrollText /> Open ledger
              </ActionButton>
              <ActionButton variant="outline" size="sm" href="/auditor/reports">
                <Download /> Export
              </ActionButton>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)]">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Your access</p>
            <div className="mt-3 space-y-1.5 text-xs">
              <Row label="Scope" value="org_citygeneral" mono />
              <Row label="Role" value="Auditor (read-only)" />
              <Row label="MFA" value="TOTP active" />
              <Row label="IP allowlist" value="203.0.113.0/24" mono />
              <Row label="Account expires" value="Jun 1, 2026" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Audit events visible", value: "12,489", icon: ScrollText },
          { label: "Consent records", value: "1,284", icon: Shield },
          { label: "Generated reports", value: 7, icon: FileBarChart2 },
          { label: "Open anomalies", value: 4, icon: AlertTriangle, warn: true },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
                <Icon className={`size-3.5 ${s.warn ? "text-[var(--color-warning)]" : ""}`} /> {s.label}
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* <ReportsWidget preset="auditor" />   */}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="text-sm font-semibold">What you can do</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              "Read every audit log event",
              "Drill into event payloads (PHI is redacted)",
              "View consent records and policy history",
              "Generate compliance reports as PDF / CSV",
              "Export evidence with cryptographic checksums",
            ].map((x) => (
              <li key={x} className="flex items-center gap-2.5">
                <CheckCircle2 className="size-4 text-[var(--color-success)]" /> {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="text-sm font-semibold">What you cannot do</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              "Modify any user, patient, or organization",
              "Create or edit consent policies",
              "Trigger break-glass or override workflows",
              "Read PHI content (notes, prescriptions, messages)",
              "Send messages or schedule appointments",
            ].map((x) => (
              <li key={x} className="flex items-center gap-2.5">
                <Lock className="size-4 text-[var(--color-muted-foreground)]" /> {x}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-info)]/30 bg-[var(--color-info-soft)]/30 p-4 text-xs">
        <div className="flex items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-card)] text-[var(--color-info)] ring-1 ring-[var(--color-info)]/30">
            <Clock className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Your activity is itself audit-logged</p>
            <p className="mt-0.5 text-[var(--color-muted-foreground)]">
              Every view, drill-down, and export you perform produces an event in the
              tenant&apos;s audit ledger. Compliance Manager sees an &quot;auditor.view&quot; entry
              for each one.
            </p>
            <div className="mt-2"><SecurityBadge variant="audited" /></div>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className={`font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
