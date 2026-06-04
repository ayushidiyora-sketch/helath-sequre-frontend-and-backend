"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { SimpleNotification } from "@/components/shared/notifications-list";

/** Default poll interval — near-real-time without hammering the API. */
const POLL_MS = 20_000;
/** Other parts of the app can dispatch this to force an immediate refresh
 *  (e.g. right after granting consent or sending a message). */
export const NOTIFICATIONS_CHANGED_EVENT = "hs:notifications-changed";

/** Fire-and-forget: tell every live notifications hook to refetch now. */
export function notifyNotificationsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}

/**
 * Read notifications are removed from the feed. Because the feed is recomputed
 * server-side on every poll (consent requests, appointments, …) there's no
 * per-item read flag in the DB, so we remember dismissed ids client-side and
 * filter them out — that keeps a read notification gone across polls and reloads.
 */
const READ_KEY = "hs_notifications_read";

function loadReadIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(set: Set<string>): void {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...set]));
  } catch {
    // Storage disabled — read state just won't persist across reloads.
  }
}

interface UseNotificationsOptions {
  /** Show a sonner toast when a new unread notification arrives after first load. */
  toastOnNew?: boolean;
  /** Override the poll interval (ms). */
  pollMs?: number;
}

interface UseNotificationsResult {
  /** The current feed (read items already filtered out), or `null` while the
   *  first load is in flight. */
  items: SimpleNotification[] | null;
  /** Live count of notifications in the feed. */
  unread: number;
  /** True until the first fetch resolves. */
  loading: boolean;
  /** Refetch immediately. */
  refresh: () => void;
  /** Mark one notification read — removes it from the feed and remembers it. */
  markRead: (id: string) => void;
  /** Mark every current notification read — empties the feed. */
  markAllRead: () => void;
}

/**
 * Live notifications feed. Fetches `/api/notifications` on mount, then keeps it
 * fresh by polling on an interval, refetching when the tab regains focus, and
 * responding to the `hs:notifications-changed` window event for instant updates
 * after a user action. Replaces the previous fetch-once-on-load behaviour so the
 * bell badge and notifications page reflect new events without a manual reload.
 *
 * When `toastOnNew` is set, newly-arrived unread notifications surface a sonner
 * toast — the "live push" UX. The very first load never toasts (it seeds the
 * seen-set), so users aren't spammed with their entire backlog on arrival.
 */
export function useNotifications(opts: UseNotificationsOptions = {}): UseNotificationsResult {
  const { toastOnNew = false, pollMs = POLL_MS } = opts;
  const [items, setItems] = useState<SimpleNotification[] | null>(null);

  const seenIds = useRef<Set<string> | null>(null); // null until first load completes
  const cancelled = useRef(false);
  const itemsRef = useRef<SimpleNotification[] | null>(null);
  itemsRef.current = items;
  const toastRef = useRef(toastOnNew);
  toastRef.current = toastOnNew;

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      const data = (await r.json()) as { ok?: boolean; items?: SimpleNotification[] };
      if (cancelled.current) return;
      const read = loadReadIds();
      const next = (Array.isArray(data?.items) ? data.items : []).filter((n) => !read.has(n.id));

      if (seenIds.current === null) {
        // First load — seed the seen-set, never toast the backlog.
        seenIds.current = new Set(next.map((n) => n.id));
      } else {
        const fresh = next.filter((n) => !seenIds.current!.has(n.id) && !n.read);
        for (const n of next) seenIds.current.add(n.id);
        if (toastRef.current && fresh.length === 1) {
          toast(fresh[0].title, { description: fresh[0].body });
        } else if (toastRef.current && fresh.length > 1) {
          toast(`${fresh.length} new notifications`, {
            description: "Open notifications to review them.",
          });
        }
      }
      setItems(next);
    } catch {
      // Network blip — keep whatever we had; just make sure we leave the
      // loading state on the very first attempt so the UI isn't stuck.
      if (!cancelled.current) setItems((cur) => (cur === null ? [] : cur));
    }
  }, []);

  useEffect(() => {
    cancelled.current = false;
    void load();
    const tick = window.setInterval(load, pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const onChanged = () => void load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      cancelled.current = true;
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
  }, [load, pollMs]);

  const markRead = useCallback((id: string) => {
    const read = loadReadIds();
    read.add(id);
    saveReadIds(read);
    setItems((cur) => (cur ? cur.filter((n) => n.id !== id) : cur));
    // Keep other live instances (e.g. the header bell) in sync.
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }, []);

  const markAllRead = useCallback(() => {
    const read = loadReadIds();
    (itemsRef.current ?? []).forEach((n) => read.add(n.id));
    saveReadIds(read);
    setItems([]);
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }, []);

  const unread = items ? items.length : 0;
  return { items, unread, loading: items === null, refresh: load, markRead, markAllRead };
}
