"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, PasswordInput } from "@/components/ui/input";
import { SecurityBadge } from "@/components/shared/security-badge";

function ResetPasswordInner() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") ?? "";

  const [tokenState, setTokenState] = useState<"checking" | "valid" | "invalid">("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setTokenState("invalid");
      setTokenError("No reset token in the URL. Open the reset link from your email.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setTokenState("invalid");
          setTokenError(data.error ?? "This reset link is invalid or has expired.");
          return;
        }
        setEmail(data.email ?? null);
        setTokenState("valid");
      } catch {
        if (cancelled) return;
        setTokenState("invalid");
        setTokenError("Network error — could not verify the reset link.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword: confirm }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.error ?? "Could not update password.";
        setError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }
      setDone(true);
      toast.success("Password updated — redirecting to sign in…");
      setTimeout(() => router.push("/login"), 2200);
    } catch {
      const msg = "Network error — could not reach the server.";
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  }

  if (tokenState === "checking") {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
          <Loader2 className="size-6 animate-spin" />
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">Verifying your reset link…</p>
      </div>
    );
  }

  if (tokenState === "invalid") {
    return (
      <div className="space-y-6">
        <div className="space-y-2.5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
            <AlertCircle className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Link expired or invalid</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">{tokenError}</p>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href="/forgot-password">
            Request a new reset link <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-6">
        <div className="space-y-2.5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-success-soft)] text-[var(--color-success)]">
            <CheckCircle2 className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            All active sessions have been revoked. Redirecting you to sign in…
          </p>
        </div>
        <div className="flex justify-center">
          <SecurityBadge variant="audited" label="Reset audit-logged" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
          Token verified
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Set a new password</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {email ? (
            <>
              For <span className="font-medium text-[var(--color-foreground)]">{email}</span>.{" "}
            </>
          ) : null}
          Choose a password you haven&apos;t used here in the last five resets.
        </p>
      </div>

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
          <Label htmlFor="pw">New password</Label>
          <PasswordInput
            id="pw"
            leadingIcon={<Lock />}
            placeholder="Min 12 chars · upper, lower, digit, symbol"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <PasswordInput
            id="confirm"
            leadingIcon={<Lock />}
            placeholder="Repeat password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success)]">
              <ShieldCheck className="size-4" />
            </span>
            <div className="text-xs text-[var(--color-muted-foreground)]">
              All active sessions and devices will be revoked after the reset
              completes. You&apos;ll be prompted to sign in again.
            </div>
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Updating…
            </>
          ) : (
            <>
              Update password &amp; sign out everywhere <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <div className="flex justify-center">
        <SecurityBadge variant="audited" label="This action is audit-logged" />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
            <Loader2 className="size-6 animate-spin" />
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)]">Loading…</p>
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
