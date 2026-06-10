"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowRight, Clock, AlertCircle, Mail, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SecurityBadge } from "@/components/shared/security-badge";

const OTP_LENGTH = 6;
// Mirrors OTP_TTL_SECONDS in lib/auth.ts — kept local so this client
// component doesn't pull the server auth module into the browser bundle.
const OTP_TTL_SECONDS = 10 * 60;

/** Mask an email as a•••@domain so it can be shown without fully exposing it. */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const head = name.slice(0, 1);
  return `${head}${"•".repeat(Math.max(name.length - 1, 2))}@${domain}`;
}

export default function MfaChallengePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Pull the in-progress sign-in handed over by the login page.
  const [mode, setMode] = useState<"email" | "totp">("email");
  useEffect(() => {
    const e = sessionStorage.getItem("hs_otp_email");
    setEmail(e);
    setDevOtp(sessionStorage.getItem("hs_otp_dev"));
    const m = sessionStorage.getItem("hs_otp_mode");
    setMode(m === "totp" ? "totp" : "email");
    if (e) inputs.current[0]?.focus();
  }, []);

  // Countdown — the code expires after OTP_TTL_SECONDS.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const submit = useCallback(
    async (code: string) => {
      setVerifying(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          const msg = data.error ?? "Verification failed.";
          setError(msg);
          toast.error(msg);
          setDigits(Array(OTP_LENGTH).fill(""));
          inputs.current[0]?.focus();
          if (data.expired) {
            sessionStorage.removeItem("hs_otp_email");
            sessionStorage.removeItem("hs_otp_dev");
            setTimeout(() => router.push("/login"), 2500);
          }
          setVerifying(false);
          return;
        }
        toast.success("Verified — signing you in");
        sessionStorage.removeItem("hs_otp_email");
        sessionStorage.removeItem("hs_otp_dev");
        const next = sessionStorage.getItem("hs_otp_next");
        sessionStorage.removeItem("hs_otp_next");
        router.push(next && next.startsWith("/") ? next : data.redirect);
        router.refresh();
      } catch {
        const msg = "Network error — could not reach the server.";
        setError(msg);
        toast.error(msg);
        setVerifying(false);
      }
    },
    [router],
  );

  function setDigit(i: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((x, idx) => (idx === i ? "" : x)));
      return;
    }
    setDigits((d) => {
      const next = [...d];
      // Support pasting the whole code into any single box.
      if (clean.length > 1) {
        for (let k = 0; k < OTP_LENGTH; k++) next[k] = clean[k] ?? "";
        const filledTo = Math.min(clean.length, OTP_LENGTH) - 1;
        inputs.current[filledTo]?.focus();
        if (next.every((x) => x !== "")) submit(next.join(""));
        return next;
      }
      next[i] = clean;
      if (i < OTP_LENGTH - 1) inputs.current[i + 1]?.focus();
      if (next.every((x) => x !== "")) submit(next.join(""));
      return next;
    });
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-otp", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.error ?? "Could not resend the code.";
        setError(msg);
        toast.error(msg);
        if (data.expired) setTimeout(() => router.push("/login"), 2500);
        setResending(false);
        return;
      }
      if (data.devOtp) {
        setDevOtp(data.devOtp);
        sessionStorage.setItem("hs_otp_dev", data.devOtp);
      }
      toast.success("A new code is on its way to your email");
      setDigits(Array(OTP_LENGTH).fill(""));
      setSecondsLeft(OTP_TTL_SECONDS);
      inputs.current[0]?.focus();
    } catch {
      const msg = "Network error — could not reach the server.";
      setError(msg);
      toast.error(msg);
    }
    setResending(false);
  }

  // Reached without a login in progress.
  if (email === null) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
          <KeyRound className="size-6" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">No sign-in in progress</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Start from the sign-in page to receive a verification code.
          </p>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href="/login">Go to sign in <ArrowRight /></Link>
        </Button>
      </div>
    );
  }

  const expired = secondsLeft <= 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="space-y-7">
      <div className="space-y-2.5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-inset ring-[var(--color-primary)]/15">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Verify it&apos;s you</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Enter the 6-digit verification code for{" "}
          <span className="font-medium text-[var(--color-foreground)]">{maskEmail(email)}</span>{" "}
          to finish signing in.{" "}
          {mode === "totp"
            ? "Open your authenticator app (Google Authenticator, Authy, …) and copy the current code."
            : "Use the code we just sent you by email."}
        </p>
      </div>

      {/* Dev mode: no SMTP configured — show the code instead of emailing it. */}
      {devOtp && (
        <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-[var(--color-primary)]/40 bg-[var(--color-primary-50)]/50 px-3.5 py-2.5 text-sm">
          <Mail className="size-4 shrink-0 text-[var(--color-primary-700)]" />
          <span className="text-[var(--color-muted-foreground)]">
            Dev mode · your code is{" "}
            <code className="rounded bg-[var(--color-card)] px-1.5 py-0.5 font-mono font-semibold tracking-widest text-[var(--color-foreground)]">
              {devOtp}
            </code>
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const code = digits.join("");
          if (code.length === OTP_LENGTH) submit(code);
        }}
      >
        <div className="flex justify-center gap-2.5">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              maxLength={OTP_LENGTH}
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={verifying || expired}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              className="size-12 rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] text-center font-mono text-lg font-semibold focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15 disabled:opacity-50"
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-muted-foreground)]">
          <Clock className="size-3.5" />
          {expired ? (
            <span className="text-[var(--color-danger)]">Code expired — request a new one</span>
          ) : (
            <>
              Code expires in{" "}
              <span className="font-mono font-medium text-[var(--color-foreground)]">
                {mm}:{ss}
              </span>
            </>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={verifying || expired || digits.join("").length !== OTP_LENGTH}
        >
          {verifying ? (
            <>
              <Loader2 className="animate-spin" /> Verifying…
            </>
          ) : (
            <>
              Verify &amp; sign in <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <div className="space-y-3 text-center text-xs">
        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="font-medium text-[var(--color-primary-700)] hover:underline disabled:opacity-50"
        >
          {resending ? "Sending…" : "Didn't get it? Resend code"}
        </button>
        <div>
          <Link href="/login" className="text-[var(--color-muted-foreground)] hover:underline">
            Back to sign in
          </Link>
        </div>
        <div className="flex justify-center">
          <SecurityBadge variant="audited" />
        </div>
      </div>
    </div>
  );
}
