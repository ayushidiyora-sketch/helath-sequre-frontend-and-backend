"use client";

import { NotificationsList } from "./notifications-list";
import { useNotifications } from "@/lib/use-notifications";

/**
 * Fetches the signed-in user's notifications from `/api/notifications` (which
 * branches by role server-side and reads real DB rows: consent requests,
 * appointments, prescriptions, tenant signups, etc.) and renders them with the
 * shared `NotificationsList` UI. Used by every role's `/notifications` page so
 * the feed is dynamic rather than hardcoded per role.
 *
 * Uses the live `useNotifications` hook so the feed refreshes on a poll, on tab
 * focus, and on the `hs:notifications-changed` event — no manual reload needed.
 * Toasts are left to the header bell to avoid double-notifying on this page.
 */
export function DynamicNotifications() {
  const { items, markRead, markAllRead } = useNotifications();

  if (items === null) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading notifications…
      </div>
    );
  }

  return <NotificationsList items={items} onRead={markRead} onReadAll={markAllRead} />;
}
