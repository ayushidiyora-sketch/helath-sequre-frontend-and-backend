"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginHrefForPath } from "@/lib/login-href";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Fallback idle window when the policy endpoint hasn't replied yet (or fails).
 * Clinical roles default to 15 min, patients to 30 — the endpoint will overwrite
 * this with the tenant's actual configured value once it loads.
 */
const FALLBACK_IDLE_MS = 15 * 60 * 1000;
/** How long before expiry the warning dialog appears. */
const WARN_MS = 30 * 1000;

/**
 * Idle-timeout guard for the authenticated dashboards.
 *
 * Watches for user activity (mouse, keyboard, scroll, touch). When the
 * configured idle window elapses with no activity, signs the user out.
 * A warning dialog appears 30 seconds before that, with a live countdown
 * and a "Stay signed in" button.
 *
 * The idle window itself is loaded from `/api/me/idle-policy`, which derives
 * it from `organizations.settings.policy.{patientSessionMinutes |
 * clinicalSessionMinutes}` based on the signed-in user's role. Until the
 * endpoint resolves, FALLBACK_IDLE_MS is used.
 */
export function IdleTimeout() {
  const router = useRouter();
  const pathname = usePathname();
  const [warnOpen, setWarnOpen] = useState(false);
  const [idleMs, setIdleMs] = useState<number>(FALLBACK_IDLE_MS);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(WARN_MS / 1000));
  const [signingOut, setSigningOut] = useState(false);

  const lastActivity = useRef(Date.now());
  const warnOpenRef = useRef(false);
  const doneRef = useRef(false);
  const idleMsRef = useRef(FALLBACK_IDLE_MS);

  // Keep a ref of the current idleMs so the interval below always reads the
  // latest value without needing to re-bind on every change.
  useEffect(() => {
    idleMsRef.current = idleMs;
  }, [idleMs]);

  // Fetch tenant policy once on mount. If it fails or returns a bad value,
  // the fallback stays in place — the dashboard remains usable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me/idle-policy", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { ok?: boolean; minutes?: number };
        if (cancelled || !j?.ok) return;
        const m = typeof j.minutes === "number" ? j.minutes : NaN;
        if (Number.isFinite(m) && m >= 1 && m <= 720) {
          setIdleMs(Math.floor(m) * 60_000);
        }
      } catch {
        // Quiet failure — keep the fallback window.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the call fails, send the user to the role-appropriate sign-in page.
    }
    router.push(loginHrefForPath(pathname));
    router.refresh();
  }, [router, pathname]);

  /** "Stay signed in" — reset the idle clock and dismiss the warning. */
  const stay = useCallback(() => {
    lastActivity.current = Date.now();
    warnOpenRef.current = false;
    setWarnOpen(false);
  }, []);

  useEffect(() => {
    // Passive activity resets the idle clock — but NOT while the warning is
    // open: there the user must explicitly choose "Stay signed in".
    const onActivity = () => {
      if (!warnOpenRef.current) lastActivity.current = Date.now();
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = setInterval(() => {
      if (doneRef.current) return;
      const limit = idleMsRef.current;
      const idle = Date.now() - lastActivity.current;

      if (idle >= limit) {
        logout();
      } else if (idle >= limit - WARN_MS) {
        if (!warnOpenRef.current) {
          warnOpenRef.current = true;
          setWarnOpen(true);
        }
        setSecondsLeft(Math.ceil((limit - idle) / 1000));
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(tick);
    };
  }, [logout]);

  return (
    <Dialog open={warnOpen} onOpenChange={() => { /* dismiss only via the buttons */ }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-2xl bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
            <Clock className="size-6" />
          </div>
          <DialogTitle className="text-center">Session about to expire</DialogTitle>
          <DialogDescription className="text-center">
            You&apos;ve been inactive. For your security you&apos;ll be signed out in{" "}
            <span className="font-mono font-semibold text-[var(--color-foreground)]">
              {secondsLeft}s
            </span>
            .
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={logout} disabled={signingOut}>
            Sign out now
          </Button>
          <Button onClick={stay} disabled={signingOut}>
            {signingOut ? <Loader2 className="animate-spin" /> : null} Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
