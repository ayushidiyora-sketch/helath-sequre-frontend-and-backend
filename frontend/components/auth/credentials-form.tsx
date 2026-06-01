"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, ArrowRight, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SecurityBadge } from "@/components/shared/security-badge";

interface CredentialsFormProps {
  /** Which portal this form belongs to — sent to the API for role gating. */
  scope: "patient" | "staff" | "super";
}

function CredentialsFormInner({ scope }: CredentialsFormProps) {
  const router = useRouter();
  const search = useSearchParams();
  const onboardToken = search.get("onboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardNote, setOnboardNote] = useState<
    { kind: "fresh"; name: string | null } | { kind: "consumed" } | null
  >(null);

  // One-time exchange of the onboarding token for the real credentials. The
  // server deletes the stashed password after the first hit, so reloading
  // this URL afterwards just refills the email but not the password.
  const exchangedRef = useRef(false);
  useEffect(() => {
    if (!onboardToken || exchangedRef.current) return;
    exchangedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/onboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: onboardToken }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error ?? "This onboarding link is invalid or has expired.");
          return;
        }
        if (typeof data.email === "string") setEmail(data.email);
        if (typeof data.password === "string" && data.password) {
          setPassword(data.password);
          setOnboardNote({ kind: "fresh", name: typeof data.name === "string" ? data.name : null });
        } else if (data.consumed) {
          setOnboardNote({ kind: "consumed" });
        }
      } catch {
        setError("Network error — could not load your onboarding details.");
      }
    })();
  }, [onboardToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, scope }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sign-in failed. Please try again.");
        setLoading(false);
        return;
      }
      // Fast-path: server skipped MFA (typical for patients) — session cookie
      // is already set, follow the redirect straight to the portal.
      if (data.skipMfa && typeof data.redirect === "string") {
        const next = new URLSearchParams(window.location.search).get("next");
        router.push(next && next.startsWith("/") ? next : data.redirect);
        router.refresh();
        return;
      }
      sessionStorage.setItem("hs_otp_email", data.email ?? email);
      sessionStorage.setItem("hs_otp_mode", data.mode === "totp" ? "totp" : "email");
      if (data.devOtp) sessionStorage.setItem("hs_otp_dev", data.devOtp);
      else sessionStorage.removeItem("hs_otp_dev");
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && next.startsWith("/")) sessionStorage.setItem("hs_otp_next", next);
      else sessionStorage.removeItem("hs_otp_next");
      router.push("/mfa-challenge");
    } catch {
      setError("Network error — could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {onboardNote?.kind === "fresh" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary-50)]/50 px-3.5 py-2.5 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--color-primary-700)]" />
          <div className="text-[var(--color-muted-foreground)]">
            <p className="font-medium text-[var(--color-foreground)]">
              {onboardNote.name ? `Welcome, ${onboardNote.name}` : "Welcome"} — credentials pre-filled
            </p>
            <p className="mt-0.5 text-xs">
              We&apos;ve filled your sign-in details from the welcome email. Continue to verify,
              then change your password from Settings.
            </p>
          </div>
        </div>
      )}

      {onboardNote?.kind === "consumed" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-sm text-[var(--color-warning)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            This onboarding link has already been used. Sign in with the password you chose, or
            use <Link href="/forgot-password" className="underline">Forgot password?</Link>
          </span>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            leadingIcon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[var(--color-primary-700)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="At least 12 characters"
            autoComplete="current-password"
            leadingIcon={<Lock />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <input
            type="checkbox"
            className="size-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
          />
          Keep me signed in for 12 hours
        </label>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Signing in…
            </>
          ) : (
            <>
              Continue <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <div className="flex items-center justify-center gap-2">
        <SecurityBadge variant="encrypted" />
        <SecurityBadge variant="mfa" />
      </div>
    </div>
  );
}

/**
 * Email + password sign-in form shared by the patient and staff portals.
 * On success it hands off to the OTP screen; the `scope` gates which roles
 * the backend will accept. Wrapped in Suspense so `useSearchParams` (read
 * for the optional onboarding link) doesn't break static prerender.
 */
export function CredentialsForm({ scope }: CredentialsFormProps) {
  return (
    <Suspense fallback={<CredentialsFormSkeleton />}>
      <CredentialsFormInner scope={scope} />
    </Suspense>
  );
}

function CredentialsFormSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-10 rounded-lg bg-[var(--color-muted)]/40" />
      <div className="h-10 rounded-lg bg-[var(--color-muted)]/40" />
      <div className="h-11 rounded-lg bg-[var(--color-muted)]/40" />
    </div>
  );
}
