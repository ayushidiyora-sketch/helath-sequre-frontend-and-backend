"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { SimpleNotification } from "@/components/shared/notifications-list";

/** Default poll interval — near-real-time without hammering the API. */
const POLL_MS = 20_000;
/** Reuse a just-fetched feed across hook instances / Strict-Mode double-mounts
 *  / coinciding ticks within this window — collapses duplicate requests. */
const CACHE_FRESH_MS = 5_000;
/** Other parts of the app can dispatch this to force an immediate refresh
 *  (e.g. right after granting consent or sending a message). */
export const NOTIFICATIONS_CHANGED_EVENT = "hs:notifications-changed";

/** Fire-and-forget: tell every live notifications hook to refetch now. */
export function notifyNotificationsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}

// ---------------------------------------------------------------------------
// Shared poller (module-scoped). Every `useNotifications` instance subscribes
// to ONE timer + ONE cached feed, so N mounted instances (header bell +
// notifications page, doubled by React Strict Mode in dev) produce a single
// poll, not N. The Page Visibility API pauses the timer while the tab is
// hidden; a 401 stops it (polling runs only for authenticated users).
// ---------------------------------------------------------------------------
let feedCache: { items: SimpleNotification[]; at: number } | null = null;
let feedInFlight: Promise<SimpleNotification[] | null> | null = null;
let sharedTimer: number | null = null;
let sharedUnauth = false;
const subscribers = new Set<() => void>();

/** Fetch the raw feed once, sharing the in-flight promise + a short cache
 *  across all callers. Returns `null` on 401 (signed out). */
function fetchFeed(force: boolean): Promise<SimpleNotification[] | null> {
  if (!force && feedCache && Date.now() - feedCache.at < CACHE_FRESH_MS) {
    return Promise.resolve(feedCache.items);
  }
  if (feedInFlight) return feedInFlight; // dedupe concurrent loads
  feedInFlight = (async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.status === 401) return null;
      const data = (await r.json()) as { ok?: boolean; items?: SimpleNotification[] };
      const items = Array.isArray(data?.items) ? data.items : [];
      feedCache = { items, at: Date.now() };
      return items;
    } catch {
      // Network blip — keep the last good cache (or empty on first attempt).
      return feedCache ? feedCache.items : [];
    } finally {
      feedInFlight = null;
    }
  })();
  return feedInFlight;
}

/** Drop the cache so the next load is guaranteed fresh (after a user action). */
function invalidateFeedCache(): void {
  feedCache = null;
}

async function pollOnce(force: boolean): Promise<void> {
  if (sharedUnauth) return;
  const raw = await fetchFeed(force);
  if (raw === null) {
    // Signed out → stop the shared timer; instances settle their loading state.
    sharedUnauth = true;
    teardownSharedTimer();
  }
  subscribers.forEach((fn) => fn());
}

function onVisible(): void {
  if (typeof document !== "undefined" && document.visibilityState === "visible") void pollOnce(false);
}
function onChanged(): void {
  invalidateFeedCache();
  void pollOnce(true);
}

function setupSharedTimer(intervalMs: number): void {
  if (sharedTimer || typeof window === "undefined") return;
  sharedTimer = window.setInterval(() => {
    // Page Visibility API: skip polling entirely while the tab is hidden.
    if (document.visibilityState === "visible") void pollOnce(false);
  }, intervalMs);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
}
function teardownSharedTimer(): void {
  if (sharedTimer) {
    clearInterval(sharedTimer);
    sharedTimer = null;
  }
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
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
 * Live notifications feed. All instances share ONE poller + cache (see above),
 * so the bell badge and the notifications page stay in sync from a single
 * request stream that pauses when the tab is hidden and resumes on focus /
 * after a `hs:notifications-changed` action — without a manual reload.
 *
 * When `toastOnNew` is set, newly-arrived unread notifications surface a sonner
 * toast — the "live push" UX. The very first load never toasts (it seeds the
 * seen-set), so users aren't spammed with their entire backlog on arrival.
 */
export function useNotifications(opts: UseNotificationsOptions = {}): UseNotificationsResult {
  const { toastOnNew = false, pollMs = POLL_MS } = opts;
  const [items, setItems] = useState<SimpleNotification[] | null>(null);

  const seenIds = useRef<Set<string> | null>(null); // null until first apply
  const itemsRef = useRef<SimpleNotification[] | null>(null);
  itemsRef.current = items;
  const toastRef = useRef(toastOnNew);
  toastRef.current = toastOnNew;

  // Re-derive this instance's view from the shared cache: filter dismissed ids,
  // toast genuinely-new ones (per instance), and update local state.
  const apply = useCallback(() => {
    const raw = feedCache?.items ?? [];
    const read = loadReadIds();
    const next = raw.filter((n) => !read.has(n.id));

    if (seenIds.current === null) {
      // First apply — seed the seen-set, never toast the backlog.
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
  }, []);

  useEffect(() => {
    let active = true;
    const sub = () => {
      if (active) apply();
    };
    subscribers.add(sub);
    sharedUnauth = false; // a fresh mount re-enables polling (session is present)

    // Paint instantly from a warm cache (another instance already fetched);
    // otherwise the first poll fills it. Either way one shared request runs.
    if (feedCache) apply();
    void pollOnce(false);
    setupSharedTimer(pollMs);

    return () => {
      active = false;
      subscribers.delete(sub);
      if (subscribers.size === 0) teardownSharedTimer();
    };
  }, [apply, pollMs]);

  const markRead = useCallback((id: string) => {
    const read = loadReadIds();
    read.add(id);
    saveReadIds(read);
    setItems((cur) => (cur ? cur.filter((n) => n.id !== id) : cur));
    // Invalidate + broadcast so every live instance re-derives from a fresh feed.
    invalidateFeedCache();
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }, []);

  const markAllRead = useCallback(() => {
    const read = loadReadIds();
    (itemsRef.current ?? []).forEach((n) => read.add(n.id));
    saveReadIds(read);
    setItems([]);
    invalidateFeedCache();
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }, []);

  const refresh = useCallback(() => {
    invalidateFeedCache();
    void pollOnce(true);
  }, []);

  const unread = useMemo(() => (items ? items.length : 0), [items]);
  return { items, unread, loading: items === null, refresh, markRead, markAllRead };
}
