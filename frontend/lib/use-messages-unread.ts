"use client";

import { useEffect, useState } from "react";

interface ApiThread {
  unread: number;
}

/**
 * Polls `/api/messages/threads` every 30s and returns the total unread count
 * across all threads for the signed-in user. Used by the role sidebars and
 * dashboards to surface the count next to the Messages nav entry.
 *
 * Returns 0 while loading or when the API can't be reached — never throws
 * up to the caller.
 */
export function useMessagesUnread(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/messages/threads", { cache: "no-store" });
        const data = (await r.json()) as { ok?: boolean; threads?: ApiThread[] };
        if (cancelled || !data?.ok || !Array.isArray(data.threads)) return;
        const total = data.threads.reduce((sum, t) => sum + (Number.isFinite(t.unread) ? t.unread : 0), 0);
        setCount(total);
      } catch {
        // Network blip — keep the existing count and try again on the next tick.
      }
    };
    void load();
    const tick = window.setInterval(() => { if (!document.hidden) void load(); }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, []);

  return count;
}
