"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SecurityBadge } from "@/components/shared/security-badge";

interface CredentialsFormProps {
  /** Which portal this form belongs to — sent to the API for role gating. */
  scope: "patient" | "staff" | "super";
  /** Demo accounts shown as quick-fill chips. */
  demoAccounts: [label: string, email: string][];
}

const DEMO_PASSWORD = "Demo!Pass1234";

/**
 * Email + password sign-in form shared by the patient and staff portals.
 * On success it hands off to the OTP screen; the `scope` gates which roles
 * the backend will accept.
 */
export function CredentialsForm({ scope, demoAccounts }: CredentialsFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Password accepted — hand off to the OTP verification screen.
      sessionStorage.setItem("hs_otp_email", data.email ?? email);
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

      {/* Demo credentials — seeded accounts, one shared password */}
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3.5 text-[11px] text-[var(--color-muted-foreground)]">
        <p className="font-semibold text-[var(--color-foreground)]">
          Demo accounts · password{" "}
          <code className="rounded bg-[var(--color-muted)] px-1 py-0.5">{DEMO_PASSWORD}</code>
        </p>
        <div className="mt-1.5 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
          {demoAccounts.map(([label, mail]) => (
            <button
              key={mail}
              type="button"
              onClick={() => {
                setEmail(mail);
                setPassword(DEMO_PASSWORD);
              }}
              className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-[var(--color-muted)]"
            >
              <span className="font-medium text-[var(--color-foreground)]">{label}</span>
              <span className="truncate font-mono">{mail}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
