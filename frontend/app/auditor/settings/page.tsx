import { KeyRound, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";

export default function AuditorSettings() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Auditor account" description="Limited surface. Your account is time-bounded by the assignment window." />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
        <h3 className="text-sm font-semibold">Profile</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Name</Label><Input defaultValue="Anand Verma" readOnly className="bg-[var(--color-muted)]" /></div>
          <div className="space-y-1.5"><Label>Organization</Label><Input defaultValue="Independent Regulator" readOnly className="bg-[var(--color-muted)]" /></div>
          <div className="space-y-1.5"><Label>Scope</Label><Input defaultValue="org_citygeneral" readOnly className="bg-[var(--color-muted)] font-mono" /></div>
          <div className="space-y-1.5"><Label>Account expires</Label><Input defaultValue="Jun 1, 2026" readOnly className="bg-[var(--color-muted)]" /></div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-3">
        <h3 className="text-sm font-semibold">Security</h3>
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-4">
          <KeyRound className="size-5 text-[var(--color-primary-700)]" />
          <div className="flex-1">
            <p className="text-sm font-medium">TOTP enrolled</p>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">IP allowlist · 203.0.113.0/24 (regulator office)</p>
          </div>
          <Badge variant="success" size="sm" dot>Active</Badge>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-4">
          <Clock className="size-5 text-[var(--color-muted-foreground)]" />
          <div className="flex-1">
            <p className="text-sm font-medium">Session timeout</p>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">15 minutes idle · enforced by tenant policy</p>
          </div>
          <Button variant="ghost" size="sm" disabled>Locked</Button>
        </div>
      </div>

      <SecurityBadge variant="audited" />
    </>
  );
}
