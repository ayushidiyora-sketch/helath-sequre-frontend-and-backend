"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { encodeSigBrowser } from "@/lib/anomaly-sig";

type Severity = "low" | "medium" | "high" | "critical";
type Status = "open" | "investigating" | "resolved" | "dismissed";

interface FeedAnomaly {
  signature: string;
  title: string;
  summary: string;
  severity: Severity;
  status: Status;
  time: string;
}

const SEV_BG: Record<Severity, string> = {
  critical: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  high:     "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  medium:   "bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]",
  low:      "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

function sevBadge(sev: Severity) {
  if (sev === "critical") return <Badge variant="danger" size="sm" dot>Critical</Badge>;
  if (sev === "high")     return <Badge variant="danger" size="sm" dot>High</Badge>;
  if (sev === "medium")   return <Badge variant="warning" size="sm" dot>Medium</Badge>;
  return <Badge variant="muted" size="sm" dot>Low</Badge>;
}

export function AnomalyFeed() {
  const [items, setItems] = useState<FeedAnomaly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/compliance/anomalies", { cache: "no-store" });
        const json = await res.json();
        if (!alive || !json?.ok) return;
        const open = (json.anomalies as FeedAnomaly[]).filter(
          (a) => a.status === "open" || a.status === "investigating",
        );
        setItems(open.slice(0, 6));
      } catch (err) { console.error("[anomaly-feed]", err); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Open anomalies</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Auto-detected by the anomaly engine · awaiting your decision</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/compliance/anomalies">Review all <ArrowRight /></Link>
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center p-10 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Detecting…
        </div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">
          No open anomalies — the engine has nothing to flag right now.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((a) => (
            <li key={a.signature} className="flex items-start gap-3 p-4 hover:bg-[var(--color-muted)]/40">
              <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${SEV_BG[a.severity]}`}>
                <AlertTriangle className="size-4" />
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{a.title}</p>
                  {sevBadge(a.severity)}
                </div>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{a.summary}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">Detected {a.time}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/compliance/anomalies/${encodeSigBrowser(a.signature)}`}>Investigate</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
