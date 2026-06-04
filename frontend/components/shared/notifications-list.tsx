"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Filter,
  ChevronRight,
  Calendar,
  Shield,
  MessageSquare,
  FileText,
  ShieldCheck,
  ScrollText,
  Cog,
  Hourglass,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type NotificationCategory =
  | "appointment"
  | "consent"
  | "message"
  | "record"
  | "security"
  | "audit"
  | "system"
  | "approval";

export interface SimpleNotification {
  id: string;
  /** Visual category — drives the icon + gradient tile colors. */
  category: NotificationCategory;
  title: string;
  body: string;
  /** Human-readable relative time, e.g. "12m ago". */
  time: string;
  /** Optional deep-link the card should navigate to. */
  href?: string;
  read?: boolean;
  /** If true, this row counts towards the Critical tab. */
  critical?: boolean;
}

export const CATEGORY_META: Record<string, { icon: LucideIcon; color: string }> = {
  appointment: { icon: Calendar, color: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]" },
  consent: { icon: Shield, color: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]" },
  message: { icon: MessageSquare, color: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]" },
  record: { icon: FileText, color: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]" },
  security: { icon: ShieldCheck, color: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]" },
  audit: { icon: ScrollText, color: "from-[oklch(0.6_0.06_250)] to-[oklch(0.42_0.04_250)]" },
  system: { icon: Cog, color: "from-[oklch(0.62_0.18_22)] to-[oklch(0.48_0.16_22)]" },
  approval: { icon: Hourglass, color: "from-[oklch(0.7_0.15_75)] to-[oklch(0.56_0.13_55)]" },
};

type Tab = "all" | "critical";

/**
 * Notifications feed UI. Read notifications are removed from the list (and
 * remembered by the parent so they don't reappear on the next poll), so every
 * row shown is unread — opening one or "Mark all read" clears it from view.
 */
export function NotificationsList({
  items,
  onRead,
  onReadAll,
}: {
  items: SimpleNotification[];
  /** Called when a notification is read. The parent removes it from the feed
   *  and persists it as read so it doesn't reappear on the next poll. */
  onRead?: (id: string) => void;
  /** Called when "Mark all read" is pressed — clears + persists the whole feed. */
  onReadAll?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [feed, setFeed] = useState(items);

  // Read notifications are removed from the list, so the feed mirrors `items`.
  useEffect(() => {
    setFeed(items);
  }, [items]);

  const totalCount = feed.length;
  const criticalCount = feed.filter((n) => n.critical).length;

  const filtered = feed.filter((n) => (tab === "critical" ? !!n.critical : true));

  function markAllRead() {
    if (totalCount === 0) {
      toast.info("Nothing to mark", { description: "You're all caught up." });
      return;
    }
    const n = totalCount;
    setFeed([]);
    onReadAll?.();
    toast.success(`Marked ${n} as read`);
  }

  function markOneRead(id: string) {
    setFeed((curr) => curr.filter((n) => n.id !== id));
    onRead?.(id);
  }

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="all">Unread · {totalCount}</TabsTrigger>
            <TabsTrigger value="critical">Critical · {criticalCount}</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info("Filter applied", { description: "Active tab + read-state filters in effect" })
              }
            >
              <Filter /> Filter
            </Button>
            <Button variant="soft" size="sm" onClick={markAllRead}>
              <CheckCheck /> Mark all read
            </Button>
          </div>
        </div>
      </Tabs>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
            {totalCount === 0
              ? "You're all caught up — no unread notifications."
              : tab === "critical"
                ? "No critical notifications."
                  : "No notifications."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {filtered.map((n) => (
              <Row key={n.id} n={n} onOpen={() => markOneRead(n.id)} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Row({ n, onOpen }: { n: SimpleNotification; onOpen: () => void }) {
  const meta = CATEGORY_META[n.category];
  const Icon = meta.icon;
  const inner = (
    <>
      {!n.read && (
        <span className="absolute left-0 top-1/2 size-1.5 -translate-x-3 -translate-y-1/2 rounded-full bg-[var(--color-primary)]" />
      )}
      <span className={`flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${meta.color} text-white shadow-[var(--shadow-soft)]`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-sm ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
          {!n.read && <Badge variant="info" size="sm">New</Badge>}
          {n.critical && <Badge variant="danger" size="sm" dot>Critical</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{n.body}</p>
        <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
          <Bell className="mr-1 inline-block size-3" /> {n.time}
        </p>
      </div>
      <ChevronRight className="size-4 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5" />
    </>
  );

  const className = `group relative flex items-start gap-4 p-5 transition-colors hover:bg-[var(--color-muted)]/40 ${!n.read ? "bg-[var(--color-primary-50)]/30" : ""}`;

  return (
    <li>
      {n.href ? (
        <Link href={n.href} onClick={onOpen} className={className}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} className={`${className} w-full text-left`}>
          {inner}
        </button>
      )}
    </li>
  );
}
