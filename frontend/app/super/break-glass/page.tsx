import {
  Flame,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Building2,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ActionButton } from "@/components/shared/action-button";

const recent = [
  { id: "BG-0014", who: "Riya Sen", tenant: "org_greenleaf", reason: "Incident response · suspected unauthorized access (INC-0021)", started: "May 18 · 13:30 UTC", duration: "Active · 22m", status: "active" as const },
  { id: "BG-0013", who: "Riya Sen", tenant: "org_acme", reason: "Patient request to retrieve corrupted PDF — verified by Compliance Manager", started: "May 14 · 11:02 UTC", duration: "18 min", status: "closed" as const },
  { id: "BG-0012", who: "Arjun Sharma", tenant: "org_riverside", reason: "Cross-tenant data investigation — joint with regulator", started: "May 8 · 9:42 UTC", duration: "27 min", status: "closed" as const },
];

const TENANTS: { id: string; name: string }[] = [
  { id: "org_citygen", name: "City General Hospital" },
  { id: "org_riverside", name: "Riverside Family Clinic" },
  { id: "org_northpoint", name: "Northpoint Telecare" },
  { id: "org_greenleaf", name: "GreenLeaf Diagnostics" },
  { id: "org_bluepine", name: "Bluepine Pediatrics" },
  { id: "org_sunset", name: "Sunset Health" },
];

export default function BreakGlassPage() {
  return (
    <>
      <PageHeader
        eyebrow="Break-glass"
        title="Exceptional PHI elevation"
        description="Use only for incident response. Every break-glass session is time-bounded, escalates to the tenant's Compliance Manager, and is recorded as a high-sensitivity event."
        actions={<SecurityBadge variant="audited" />}
      />

      {/* Warning banner */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-card)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/30">
            <Flame className="size-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">This action grants you temporary PHI read access on the target tenant</p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Break-glass is intended for active incident response only. Routine
              support requests must go through the tenant&apos;s own admin or compliance staff.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-[var(--color-muted-foreground)]">
              <li>• 30-minute session window (max)</li>
              <li>• Auto-notifies the tenant&apos;s Compliance Manager + your manager</li>
              <li>• Every PHI read during the session is tagged <code className="font-mono">break_glass=true</code></li>
              <li>• Post-mortem review required within 24 hours</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Initiate form */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <ShieldAlert className="size-4 text-[var(--color-danger)]" /> Initiate break-glass session
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bg-target-tenant">Target tenant</Label>
              <div className="relative w-full">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-muted-foreground)] [&_svg]:size-4">
                  <Building2 />
                </span>
                <select
                  id="bg-target-tenant"
                  name="targetTenant"
                  defaultValue="org_greenleaf"
                  className="flex h-10 w-full appearance-none rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] pl-10 pr-9 py-2 text-sm transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
                >
                  {TENANTS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.id}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-muted-foreground)]">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-4">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                  </svg>
                </span>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Linked incident</Label><Input defaultValue="INC-0021" className="font-mono" /></div>
            <div className="space-y-1.5"><Label>Session duration</Label><Input defaultValue="30 min (max)" readOnly className="bg-[var(--color-muted)]" /></div>
            <div className="space-y-1.5"><Label>Re-MFA challenge</Label><Input defaultValue="Required at start + 15m" readOnly className="bg-[var(--color-muted)]" /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Justification (required · 50 chars min)</Label>
            <Textarea rows={4} placeholder="Describe the incident, who requested elevation, and what data you expect to access…" />
          </div>
          <label className="flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
            <input type="checkbox" className="mt-0.5 size-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30" required />
            <span>I acknowledge this action is audit-logged, notifies the tenant&apos;s Compliance Manager, and that misuse is grounds for termination and may constitute a HIPAA violation.</span>
          </label>
          <ActionButton
            variant="destructive"
            size="lg"
            className="w-full"
            confirm={{
              title: "Confirm break-glass elevation?",
              description: "30-min window will start immediately. Tenant Compliance Manager + your reporting manager will be paged. This is a high-sensitivity audit event.",
              confirmLabel: "Authenticate & elevate",
              variant: "destructive",
            }}
            toastMessage="Break-glass session BG-0015 started · 30:00 timer"
            toastDescription="Compliance Manager notified · elevated retention"
            toastVariant="error"
          >
            <Flame /> Initiate break-glass
          </ActionButton>
        </div>

        {/* Active session */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-card)] p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-danger)]">Active session</p>
              <Badge variant="danger" size="sm" dot>BG-0014 · 22m</Badge>
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <Row label="Operator" value="Riya Sen (you)" />
              <Row label="Tenant" value="org_greenleaf" mono />
              <Row label="Incident" value="INC-0021" mono />
              <Row label="Time remaining" value="07:48" mono />
              <Row label="MFA challenge at" value="15:02 UTC" mono />
            </dl>
            <ActionButton
              variant="outline"
              className="mt-4 w-full"
              confirm={{
                title: "Close break-glass session early?",
                description: "Session BG-0014 will end immediately. Any required reads must be done now.",
                confirmLabel: "Close session",
              }}
              toastMessage="Session BG-0014 closed"
              toastDescription="Post-mortem required within 24h"
              toastVariant="warning"
            >
              Close session early
            </ActionButton>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Auto-notifications sent</p>
            <ul className="mt-3 space-y-2 text-[var(--color-muted-foreground)]">
              <li>• Tenant Compliance Manager · email + in-app</li>
              <li>• Your reporting manager · email</li>
              <li>• Platform security log · cross-tenant entry</li>
              <li>• Anomaly engine · break-glass detector armed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recent */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
          <h2 className="text-sm font-semibold">Recent break-glass sessions</h2>
          <Badge variant="muted" size="sm">Audit · 24-month window</Badge>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {recent.map((r) => (
            <li key={r.id} className="flex items-start gap-3 p-4">
              <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${r.status === "active" ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"}`}>
                {r.status === "active" ? <Flame className="size-4" /> : <Clock className="size-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs">{r.id}</span>
                  <span className="font-semibold">{r.who}</span>
                  <span className="text-[var(--color-muted-foreground)]">on</span>
                  <span className="font-mono text-xs">{r.tenant}</span>
                </div>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{r.reason}</p>
                <p className="mt-0.5 text-[10px] text-[var(--color-muted-foreground)]">Started {r.started} · {r.duration}</p>
              </div>
              {r.status === "active" ? <Badge variant="danger" size="sm" dot>Active</Badge> : <Badge variant="muted" size="sm">Closed</Badge>}
            </li>
          ))}
        </ul>
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
