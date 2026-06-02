"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ShieldAlert, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionButton } from "@/components/shared/action-button";
import { OpenIncidentDialog } from "./open-incident-dialog";

interface ApiIncident {
  id: string;
  display: string;
  title: string;
  severity: string;
  status: string;
  scope: string | null;
  source: "manual" | "auto";
  openedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  context: string;
}

function relativeTime(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

function sevBadge(sev: string) {
  if (sev === "high") return <Badge variant="danger" size="sm" dot>High</Badge>;
  if (sev === "medium") return <Badge variant="warning" size="sm" dot>Medium</Badge>;
  return <Badge variant="warning" size="sm" dot>Minor</Badge>;
}

const STATUS_ORDER = ["open", "investigating", "mitigating", "monitoring", "resolved"];
function nextStatus(current: string): string {
  const i = STATUS_ORDER.indexOf(current);
  if (i < 0) return "investigating";
  return STATUS_ORDER[Math.min(i + 1, STATUS_ORDER.length - 1)];
}

export default function IncidentsPage() {
  const [active, setActive] = useState<ApiIncident[]>([]);
  const [closed, setClosed] = useState<ApiIncident[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const r = await fetch("/api/super/incidents", { cache: "no-store" });
      const data = await r.json();
      if (!data?.ok) return;
      setActive(Array.isArray(data.active) ? data.active : []);
      setClosed(Array.isArray(data.closed) ? data.closed : []);
    } catch {
      // network blip — keep existing lists, retry next refresh
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  async function advance(inc: ApiIncident) {
    if (inc.source === "auto") {
      toast.info("Auto-derived incident", {
        description: "Resolve the underlying signal (e.g. clear the lock) and this row will close automatically.",
      });
      return;
    }
    const status = nextStatus(inc.status);
    try {
      const r = await fetch("/api/super/incidents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inc.id, status }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        toast.error(data?.error ?? "Could not update status.");
        return;
      }
      toast.success(`${inc.display} → ${status}`, { description: "Audit-logged" });
      await reload();
    } catch {
      toast.error("Network error.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Incidents"
        description="Lifecycle: open → investigating → mitigating → monitoring → resolved. Each step is audit-logged."
        actions={<OpenIncidentDialog onCreated={() => void reload()} />}
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active · {active.length}</TabsTrigger>
          <TabsTrigger value="closed">Closed · {closed.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {loading ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
              Loading…
            </p>
          ) : active.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
              No active incidents — the platform is healthy.
            </p>
          ) : (
            <div className="space-y-4">
              {active.map((i) => (
                <div
                  key={i.id}
                  className={`overflow-hidden rounded-2xl border p-5 ${
                    i.severity === "high"
                      ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20"
                      : "border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/20"
                  }`}
                >
                  <div className="flex flex-wrap items-start gap-4">
                    <span
                      className={`flex size-11 items-center justify-center rounded-xl ${
                        i.severity === "high"
                          ? "bg-[var(--color-card)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/30"
                          : "bg-[var(--color-card)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)] ring-1 ring-[var(--color-warning)]/30"
                      }`}
                    >
                      <ShieldAlert className="size-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-xs">{i.display}</p>
                        <h3 className="text-base font-semibold">{i.title}</h3>
                        {sevBadge(i.severity)}
                        {i.source === "auto" && (
                          <Badge variant="muted" size="sm">Auto</Badge>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
                        <span className="inline-flex items-center gap-1"><Clock className="size-3" /> Opened {relativeTime(i.openedAt)}</span>
                        <span className="inline-flex items-center gap-1"><Users className="size-3" /> {i.context}</span>
                        <Badge variant="info" size="sm" dot>{i.status}</Badge>
                        {i.scope && <span className="font-mono text-[10px]">{i.scope}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <ActionButton variant="outline" size="sm" toastMessage={`Runbook for ${i.display} opened`} toastVariant="info">
                        Open runbook
                      </ActionButton>
                      <Button size="sm" onClick={() => void advance(i)}>
                        {i.source === "auto" ? "Auto-managed" : "Update status"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closed">
          {loading ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
              Loading…
            </p>
          ) : closed.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
              No incidents closed in the last 30 days.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <ul className="divide-y divide-[var(--color-border)]">
                {closed.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 p-4">
                    <CheckCircle2 className="size-5 text-[var(--color-success)]" />
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="mr-2 font-mono text-xs text-[var(--color-muted-foreground)]">{i.display}</span>
                        <span className="font-semibold">{i.title}</span>
                      </p>
                      <p className="text-[11px] text-[var(--color-muted-foreground)]">
                        Closed {i.resolvedAt ? relativeTime(i.resolvedAt) : relativeTime(i.openedAt)}
                        {i.resolutionNote && ` · ${i.resolutionNote}`}
                      </p>
                    </div>
                    {i.severity === "high" ? <Badge variant="danger" size="sm">High · resolved</Badge> : <Badge variant="muted" size="sm">Resolved</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
