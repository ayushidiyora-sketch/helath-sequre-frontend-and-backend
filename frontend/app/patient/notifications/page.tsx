"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Filter,
  Calendar,
  Shield,
  FileText,
  MessageSquare,
  KeyRound,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePatientStore, type NotificationType, type PatientNotification } from "@/lib/patient-store";

const TYPE_META: Record<
  NotificationType,
  { icon: LucideIcon; color: string }
> = {
  appointment: { icon: Calendar, color: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]" },
  consent: { icon: Shield, color: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]" },
  message: { icon: MessageSquare, color: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]" },
  record: { icon: FileText, color: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]" },
  security: { icon: KeyRound, color: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]" },
};

type Tab = "all" | "unread" | "security";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const { state, markNotificationRead, markAllNotificationsRead } = usePatientStore();
  const [tab, setTab] = useState<Tab>("all");

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const all = state.notifications;
  const totalCount = all.length;
  const unreadCount = all.filter((n) => !n.read).length;
  const securityCount = all.filter((n) => n.type === "security").length;

  const filtered = all.filter((n) => {
    if (tab === "all") return true;
    if (tab === "unread") return !n.read;
    return n.type === "security";
  });

  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Stay in the loop"
        description="In-app, email, and (when enabled) SMS — all categorized and filterable."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="all">All · {totalCount}</TabsTrigger>
            <TabsTrigger value="unread">Unread · {unreadCount}</TabsTrigger>
            <TabsTrigger value="security">Security · {securityCount}</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Filter applied", { description: "Active tab + read-state filters in effect" })}
            >
              <Filter /> Filter
            </Button>
            <Button
              variant="soft"
              size="sm"
              onClick={() => {
                if (unreadCount === 0) {
                  toast.info("Nothing to mark", { description: "All notifications are already read." });
                  return;
                }
                markAllNotificationsRead();
                toast.success(`Marked ${unreadCount} as read`);
              }}
            >
              <CheckCheck /> Mark all read
            </Button>
          </div>
        </div>
      </Tabs>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
            {totalCount === 0
              ? "You're all caught up — no notifications yet."
              : tab === "unread"
                ? "You're all caught up — no unread notifications."
                : tab === "security"
                  ? "No security notifications."
                  : "No notifications."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {filtered.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onOpen={() => markNotificationRead(n.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function NotificationRow({ n, onOpen }: { n: PatientNotification; onOpen: () => void }) {
  const meta = TYPE_META[n.type];
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
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{n.body}</p>
        <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
          <Bell className="mr-1 inline-block size-3" /> {relativeTime(n.createdAt)}
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
