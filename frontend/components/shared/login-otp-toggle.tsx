"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface OtpState {
  otpRequired: boolean;
  totpEnrolled: boolean;
  demo: boolean;
}

/**
 * Self-contained "Login verification (OTP)" card — a GitHub-style toggle shown
 * on every role's profile/settings page. Reads + writes `users.mfaRequired`
 * via `/api/me/login-otp`; flipping it changes whether the next sign-in asks
 * for a one-time code. Renders read-only for demo sessions (which always
 * receive an OTP and can't persist a change).
 */
export function LoginOtpToggle() {
  const [state, setState] = useState<OtpState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me/login-otp", { cache: "no-store" });
        const j = (await r.json()) as { ok?: boolean } & Partial<OtpState>;
        if (!cancelled && j?.ok) {
          setState({ otpRequired: !!j.otpRequired, totpEnrolled: !!j.totpEnrolled, demo: !!j.demo });
        }
      } catch {
        // leave null — the card shows the error state below
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function toggle(next: boolean) {
    if (!state || saving) return;
    const prev = state;
    setState({ ...state, otpRequired: next }); // optimistic
    setSaving(true);
    try {
      const r = await fetch("/api/me/login-otp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpRequired: next }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string } & Partial<OtpState>;
      if (!r.ok || !j.ok) {
        setState(prev); // revert
        toast.error("Could not update login verification", { description: j.error ?? `HTTP ${r.status}` });
        return;
      }
      setState({ otpRequired: !!j.otpRequired, totpEnrolled: !!j.totpEnrolled, demo: !!j.demo });
      toast.success(next ? "Login OTP turned on" : "Login OTP turned off", {
        description: next
          ? "You'll be asked for a one-time code at every sign-in · audit-logged"
          : "Sign-in will no longer ask for a code · audit-logged",
      });
    } catch {
      setState(prev);
      toast.error("Network error — could not update login verification.");
    } finally {
      setSaving(false);
    }
  }

  const on = state?.otpRequired ?? false;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-[var(--color-primary-700)]" />
        <h2 className="text-sm font-semibold">Login verification (OTP)</h2>
        {!loading && state && (
          <Badge variant={on ? "success" : "muted"} size="sm" dot>
            {on ? "On" : "Off"}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        When on, you&apos;ll be asked for a one-time code each time you sign in.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : !state ? (
        <p className="mt-4 text-sm text-[var(--color-danger)]">Couldn&apos;t load your login settings.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4">
            <div className="flex items-start gap-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${on ? "bg-[var(--color-success-soft)] text-[var(--color-success)]" : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"}`}>
                {on ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />}
              </span>
              <div>
                <p className="text-sm font-medium">Require a one-time code at sign-in</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">
                  {state.totpEnrolled
                    ? "Uses your authenticator app code."
                    : "Sends a code to your email at sign-in."}
                  {state.demo ? " · Demo account — always on, can't be changed." : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {saving && <Loader2 className="size-3.5 animate-spin text-[var(--color-muted-foreground)]" />}
              <Switch
                checked={on}
                onCheckedChange={toggle}
                disabled={saving || state.demo}
                aria-label="Require a one-time code at sign-in"
              />
            </div>
          </div>
          {!on && !state.demo && (
            <p className="mt-2 text-[11px] text-[var(--color-warning)]">
              With login verification off, anyone with your password can sign in without a second factor.
            </p>
          )}
        </>
      )}
    </div>
  );
}
