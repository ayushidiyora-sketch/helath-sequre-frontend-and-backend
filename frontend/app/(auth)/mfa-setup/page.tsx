"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  ArrowRight,
  Copy,
  Smartphone,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SecurityBadge } from "@/components/shared/security-badge";

function safePath(p: string | null | undefined, fallback: string): string {
  if (p && p.startsWith("/")) return p;
  return fallback;
}

function MfaSetupInner() {
  const router = useRouter();
  const search = useSearchParams();
  const required = search.get("required") === "true";
  const next = safePath(search.get("next"), "/patient/dashboard");

  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Fetch a fresh TOTP secret + QR on mount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/mfa/setup", { method: "POST" })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || !data.ok) {
          setLoadError(data.error ?? `HTTP ${r.status}`);
          return;
        }
        setSecret(data.secret);
        setQrDataUrl(data.qrDataUrl);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Network error — could not start enrollment.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    const cleaned = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleaned)) {
      setVerifyError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setVerifying(true);
    try {
      const r = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleaned }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setVerifyError(data.error ?? "Verification failed.");
        setVerifying(false);
        return;
      }
      toast.success("Two-factor enabled", {
        description: "You'll be asked for a code on each new sign-in.",
      });
      // mfa-recovery-codes shows the one-time recovery list before the
      // user lands on their dashboard.
      router.push(`/mfa-recovery-codes?next=${encodeURIComponent(next)}`);
    } catch {
      setVerifyError("Network error — could not verify.");
      setVerifying(false);
    }
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret).then(
      () => toast.success("Secret copied"),
      () => toast.error("Could not copy"),
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
          Two-factor authentication
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Set up your authenticator</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {required
            ? "Required for this account. Pair an authenticator app to continue."
            : "Strongly recommended. Skip if you'd like to enable it later."}
        </p>
      </div>

      {loadError ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3.5 py-3 text-sm text-[var(--color-danger)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <div className="flex items-center gap-4">
            <div className="flex size-32 shrink-0 items-center justify-center rounded-lg bg-white p-2 ring-1 ring-[var(--color-border)]">
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="TOTP enrollment QR code"
                  width={120}
                  height={120}
                  className="size-28"
                  unoptimized
                />
              ) : (
                <Loader2 className="size-6 animate-spin text-[var(--color-muted-foreground)]" />
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
                  Manual entry key
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded-md bg-[var(--color-muted)] px-2.5 py-1 font-mono text-xs tracking-wider">
                    {secret ? secret.match(/.{1,4}/g)?.join(" ") : "—"}
                  </code>
                  <button
                    type="button"
                    onClick={copySecret}
                    disabled={!secret}
                    className="rounded-md p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:opacity-40"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
                <Smartphone className="mt-0.5 size-4 shrink-0 text-[var(--color-primary-700)]" />
                <span>
                  Scan with Google Authenticator, Authy, 1Password, or any RFC 6238 compatible app.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <form className="space-y-5" onSubmit={submit}>
        {verifyError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{verifyError}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="code">Enter 6-digit code to confirm</Label>
          <Input
            id="code"
            placeholder="123 456"
            inputMode="numeric"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            required
            disabled={!secret || verifying}
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={!secret || verifying}>
          {verifying ? (
            <>
              <Loader2 className="animate-spin" /> Verifying…
            </>
          ) : (
            <>
              <CheckCircle2 /> Activate two-factor <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3 text-xs">
        {required ? (
          <span className="text-[var(--color-muted-foreground)]">
            Required for this account · cannot be skipped
          </span>
        ) : (
          <Link
            href={next}
            className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            Skip for now
          </Link>
        )}
        <div className="flex items-center gap-1.5 text-[var(--color-success)]">
          <ShieldCheck className="size-3.5" />
          <span className="font-medium">Recovery codes will be issued next</span>
        </div>
      </div>

      <div className="flex justify-center">
        <SecurityBadge variant="audited" />
      </div>
    </div>
  );
}

export default function MfaSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-[var(--color-muted-foreground)]" />
        </div>
      }
    >
      <MfaSetupInner />
    </Suspense>
  );
}
