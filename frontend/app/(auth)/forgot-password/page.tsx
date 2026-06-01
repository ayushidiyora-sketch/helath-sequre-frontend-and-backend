"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  MailCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not request a reset.");
        setLoading(false);
        return;
      }
      setDevLink(typeof data.devLink === "string" ? data.devLink : null);
      setSent(true);
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-7">
        <div className="space-y-2.5">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            <ArrowLeft className="size-3.5" /> Back to sign in
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Check your inbox</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            If <span className="font-medium text-[var(--color-foreground)]">{email}</span> matches
            an account, we&apos;ve sent a reset link valid for 30 minutes. Look in spam if
            you don&apos;t see it within a minute.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success)]">
              <MailCheck className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Email queued</p>
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                For your security we show the same message whether or not the email exists.
                Reset attempts are rate-limited and audit-logged.
              </p>
            </div>
          </div>
        </div>

        {devLink && (
          <div className="rounded-xl border border-dashed border-[var(--color-primary)]/40 bg-[var(--color-primary-50)]/50 p-3.5 text-xs">
            <p className="font-medium text-[var(--color-primary-700)]">Dev mode · open the link below</p>
            <p className="mt-1 break-all text-[var(--color-muted-foreground)]">
              <Link href={devLink} className="underline hover:text-[var(--color-primary-700)]">
                {devLink}
              </Link>
            </p>
            <p className="mt-1 text-[var(--color-muted-foreground)]">
              Shown because no mail transport is configured. Set <code>RESEND_API_KEY</code> in
              <code>.env.local</code> to deliver real emails.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 text-center">
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setDevLink(null);
            }}
            className="text-xs font-medium text-[var(--color-primary-700)] hover:underline"
          >
            Didn&apos;t get it? Try again
          </button>
          <Link href="/login" className="text-xs text-[var(--color-muted-foreground)] hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reset your password</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          We&apos;ll send a signed, time-limited link to the verified email on file.
          The link expires after 30 minutes.
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
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            leadingIcon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Sending…
            </>
          ) : (
            <>
              Send reset link <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-info-soft)] text-[var(--color-info)]">
            <MailCheck className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">Didn&apos;t receive it?</p>
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              Check spam, then try again in 60 seconds. We only send to verified
              addresses to prevent enumeration attacks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
