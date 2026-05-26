import { ShieldAlert, Globe, KeyRound, Flame, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const stream = [
  { t: "14:02:18 UTC", sev: "high" as const, type: "ip.block", tenant: "org_acme", detail: "Auto-blocked 198.51.100.0/24 after 142 failed logins in 60s" },
  { t: "13:58:01 UTC", sev: "medium" as const, type: "mfa.lockout", tenant: "org_riverside", detail: "Account usr_a91e locked after 3 failures · 90s window" },
  { t: "13:42:09 UTC", sev: "info" as const, type: "ip.allowlist.update", tenant: "org_citygen", detail: "Compliance Manager added 203.0.113.0/24" },
  { t: "13:30:55 UTC", sev: "high" as const, type: "break_glass.start", tenant: "org_greenleaf", detail: "Riya Sen elevated for incident #INC-0021 · 30 min window" },
  { t: "13:14:02 UTC", sev: "medium" as const, type: "anomaly.flag", tenant: "org_acme", detail: "Bulk download · 32 docs in 4 min · off-hours" },
  { t: "12:48:48 UTC", sev: "info" as const, type: "passkey.enroll", tenant: "org_riverside", detail: "WebAuthn device enrolled · usr_4f12a" },
  { t: "12:32:01 UTC", sev: "high" as const, type: "auth.brute_force", tenant: "org_northpoint", detail: "Sustained brute-force attempt blocked by WAF" },
];

export default function SecurityStreamPage() {
  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Platform-wide event stream"
        description="Cross-tenant security events. PHI access events are tenant-scoped and not shown here without break-glass."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Events · 24h", value: 38, icon: ShieldAlert },
          { label: "High severity", value: 3, icon: AlertTriangle, danger: true },
          { label: "Active break-glass", value: 1, icon: Flame, warn: true },
          { label: "Blocked IPs", value: 14, icon: Globe },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
                <Icon className={`size-3.5 ${s.danger ? "text-[var(--color-danger)]" : s.warn ? "text-[var(--color-warning)]" : ""}`} /> {s.label}
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="high">High</TabsTrigger>
          <TabsTrigger value="ip">IP blocks</TabsTrigger>
          <TabsTrigger value="bg">Break-glass</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <table className="w-full min-w-[720px] text-sm font-mono">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Tenant</th>
                  <th className="px-4 py-2.5">Event</th>
                  <th className="px-4 py-2.5">Detail</th>
                  <th className="px-4 py-2.5 text-right">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {stream.map((e, i) => (
                  <tr key={i} className="text-xs hover:bg-[var(--color-muted)]/30">
                    <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{e.t}</td>
                    <td className="px-4 py-3">{e.tenant}</td>
                    <td className="px-4 py-3"><span className="rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px]">{e.type}</span></td>
                    <td className="px-4 py-3 font-sans text-[var(--color-muted-foreground)] whitespace-normal">{e.detail}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      {e.sev === "high" && <Badge variant="danger" size="sm" dot>High</Badge>}
                      {e.sev === "medium" && <Badge variant="warning" size="sm" dot>Medium</Badge>}
                      {e.sev === "info" && <Badge variant="info" size="sm">Info</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="high"><div className="text-sm text-[var(--color-muted-foreground)]">Filtered to high-severity events.</div></TabsContent>
        <TabsContent value="ip"><div className="text-sm text-[var(--color-muted-foreground)]">Filtered to IP block / allowlist events.</div></TabsContent>
        <TabsContent value="bg"><div className="text-sm text-[var(--color-muted-foreground)]">Filtered to break-glass elevations.</div></TabsContent>
      </Tabs>
    </>
  );
}
