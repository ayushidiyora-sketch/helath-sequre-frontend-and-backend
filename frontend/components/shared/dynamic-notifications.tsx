"use client";

import { useEffect, useState } from "react";
import { NotificationsList, type SimpleNotification } from "./notifications-list";

/**
 * Fetches the signed-in user's notifications from `/api/notifications` (which
 * branches by role server-side and reads real DB rows: consent requests,
 * appointments, prescriptions, tenant signups, etc.) and renders them with the
 * shared `NotificationsList` UI. Used by every role's `/notifications` page so
 * the feed is dynamic rather than hardcoded per role.
 */
export function DynamicNotifications() {
  const [items, setItems] = useState<SimpleNotification[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading notifications…
      </div>
    );
  }

  return <NotificationsList items={items} />;
}
