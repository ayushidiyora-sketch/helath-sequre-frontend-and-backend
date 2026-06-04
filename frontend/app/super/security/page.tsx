"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, Globe, Flame, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/**
 * Super Admin → Security stream. Every row comes from `/api/super/security`
 * which UNIONs anomaly_decisions + mfa_challenges + users (lockouts +
 * enrollments) + incidents into a single cross-tenant feed. No fixtures.
 */

interface SecurityEvent {
  time: string;
  tenant: string;
  eventType: string;
  detail: string;
  severity: string;
  iso: string;
}
interface SecurityPayload {
  stats: {
    events24h: number;
    events24hDisplay: string;
    highSeverity24h: number;
    activeBreakGlass: number;
    blockedIps: number;
  };
  events: SecurityEvent[];
}

function SeverityBadge({ sev }: { sev: string }) {
  if (sev === "high") return <Badge variant="danger" size="sm" dot>High</Badge>;
  if (sev === "medium") return <Badge variant="warning" size="sm" dot>Medium</Badge>;
  if (sev === "info") return <Badge variant="info" size="sm">Info</Badge>;
  return <Badge variant="muted" size="sm">{sev}</Badge>;
}

function EventTable({ events }: { events: SecurityEvent[] }) {
  return (
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
          {events.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center font-sans text-xs text-[var(--color-muted-foreground)]"
              >
                No events match this filter.
              </td>
            </tr>
          )}
          {events.map((e, i) => (
            <tr key={e.iso + i} className="text-xs hover:bg-[var(--color-muted)]/30">
              <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{e.time}</td>
              <td className="px-4 py-3">{e.tenant}</td>
              <td className="px-4 py-3">
                <span className="rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px]">
                  {e.eventType}
                </span>
              </td>
              <td className="px-4 py-3 font-sans text-[var(--color-muted-foreground)] whitespace-normal">
                {e.detail}
              </td>
              <td className="px-4 py-3 text-right font-sans">
                <SeverityBadge sev={e.severity} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SecurityStreamPage() {
  const [data, setData] = useState<SecurityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/super/security", { cache: "no-store" });
        const j = (await r.json()) as SecurityPayload & { ok: boolean; error?: string };
        if (!alive) return;
        if (!r.ok || !j.ok) {
          setError(j.error ?? "Could not load security stream.");
          return;
        }
        setData(j);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const events = data?.events ?? [];
  const highOnly = useMemo(() => events.filter((e) => e.severity === "high"), [events]);
  const ipOnly = useMemo(
    () =>
      events.filter(
        (e) =>
          e.eventType.startsWith("ip.") ||
          e.eventType === "auth.brute_force" ||
          e.eventType === "mfa.failure",
      ),
    [events],
  );
  const breakGlassOnly = useMemo(
    () => events.filter((e) => e.eventType === "break_glass.start"),
    [events],
  );

  if (loading) {
    return (
      <>
        <PageHeader
          eyebrow="Security"
          title="Platform-wide event stream"
          description="Cross-tenant security events. PHI access events are tenant-scoped and not shown here without break-glass."
        />
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading event stream…
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader
          eyebrow="Security"
          title="Platform-wide event stream"
          description="Cross-tenant security events. PHI access events are tenant-scoped and not shown here without break-glass."
        />
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20 p-10 text-center text-sm text-[var(--color-danger)]">
          {error ?? "Security stream unavailable."}
        </div>
      </>
    );
  }

  const stats = [
    { label: "Events · 24h", value: data.stats.events24hDisplay, icon: ShieldAlert },
    {
      label: "High severity",
      value: data.stats.highSeverity24h.toLocaleString("en-IN"),
      icon: AlertTriangle,
      danger: true,
    },
    {
      label: "Active break-glass",
      value: data.stats.activeBreakGlass.toLocaleString("en-IN"),
      icon: Flame,
      warn: true,
    },
    {
      label: "Blocked IPs",
      value: data.stats.blockedIps.toLocaleString("en-IN"),
      icon: Globe,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Platform-wide event stream"
        description="Cross-tenant security events. PHI access events are tenant-scoped and not shown here without break-glass."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
                <Icon
                  className={`size-3.5 ${
                    s.danger ? "text-[var(--color-danger)]" : s.warn ? "text-[var(--color-warning)]" : ""
                  }`}
                />{" "}
                {s.label}
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All · {events.length}</TabsTrigger>
          <TabsTrigger value="high">High · {highOnly.length}</TabsTrigger>
          <TabsTrigger value="ip">IP / MFA · {ipOnly.length}</TabsTrigger>
          <TabsTrigger value="bg">Break-glass · {breakGlassOnly.length}</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <EventTable events={events} />
        </TabsContent>
        <TabsContent value="high">
          <EventTable events={highOnly} />
        </TabsContent>
        <TabsContent value="ip">
          <EventTable events={ipOnly} />
        </TabsContent>
        <TabsContent value="bg">
          <EventTable events={breakGlassOnly} />
        </TabsContent>
      </Tabs>
    </>
  );
}
