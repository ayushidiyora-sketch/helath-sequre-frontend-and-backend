"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Smartphone, Clock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecurityBadge } from "@/components/shared/security-badge";

const DISMISS_KEY = "hs_mfa_prompt_dismissed";

/**
 * Post-login "Want to add an authenticator app?" interstitial for Patient
 * accounts. Mandatory MFA roles never see this — they're routed to
 * /mfa-setup directly. The user can skip, and the skip is remembered for
 * this browser so the prompt doesn't fire every sign-in.
 */
export default function MfaPromptPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/patient/dashboard";
  const safeNext = next.startsWith("/") ? next : "/patient/dashboard";
  const [ready, setReady] = useState(false);

  // Honor previous "skip" — bounce straight to the dashboard.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "true") {
      router.replace(safeNext);
      return;
    }
    setReady(true);
  }, [router, safeNext]);

  function skip() {
    window.localStorage.setItem(DISMISS_KEY, "true");
    router.replace(safeNext);
  }

  function enable() {
    // After MFA setup completes the user lands at /patient/dashboard.
    router.push(`/mfa-setup?next=${encodeURIComponent(safeNext)}`);
  }

  if (!ready) {
    return (
      <div className="flex min-h-[280px] items-center justify-center text-[var(--color-muted-foreground)]">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2.5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-inset ring-[var(--color-primary)]/15">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Add an extra layer of security?</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Pair an authenticator app (Google Authenticator, Authy, 1Password)
          so even someone with your password can&apos;t sign in without your
          phone. Optional for patients — strongly recommended.
        </p>
      </div>

      <ul className="space-y-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm">
        <li className="flex items-start gap-2.5">
          <Smartphone className="mt-0.5 size-4 shrink-0 text-[var(--color-primary-700)]" />
          <span className="text-[var(--color-muted-foreground)]">
            One-time setup · scan a QR code with your authenticator app.
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <Clock className="mt-0.5 size-4 shrink-0 text-[var(--color-primary-700)]" />
          <span className="text-[var(--color-muted-foreground)]">
            Takes about 60 seconds. You can enable or disable it later from
            Settings.
          </span>
        </li>
      </ul>

      <div className="flex flex-col gap-2.5">
        <Button size="lg" className="w-full" onClick={enable}>
          Enable authenticator app <ArrowRight />
        </Button>
        <Button size="lg" variant="outline" className="w-full" onClick={skip}>
          Skip for now
        </Button>
        <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
          Skipping won&apos;t ask again on this device.{" "}
          <Link href="/patient/settings" className="text-[var(--color-primary-700)] hover:underline">
            Change later in Settings
          </Link>
          .
        </p>
      </div>

      <div className="flex justify-center">
        <SecurityBadge variant="audited" />
      </div>
    </div>
  );
}
