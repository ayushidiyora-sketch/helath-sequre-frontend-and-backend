"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Lock,
  ShieldAlert,
  Clock,
  ArrowRight,
  KeyRound,
  Mail,
  ScrollText,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecurityBadge } from "@/components/shared/security-badge";

const DEFAULT_LOCKOUT_MINUTES = 15;

export default function AccountLockedPage() {
  return (
    <Suspense fallback={null}>
      <AccountLockedInner />
    </Suspense>
  );
}

function AccountLockedInner() {
  const params = useSearchParams();

  // ?unlocksAt=<iso> — when the lockout window ends. Default = 15 min from
  // the first render (gives the demo a live countdown without query params).
  const unlocksAt = useMemo(() => {
    const fromQuery = params.get("unlocksAt");
    if (fromQuery) {
      const t = Date.parse(fromQuery);
      if (Number.isFinite(t)) return t;
    }
    return Date.now() + DEFAULT_LOCKOUT_MINUTES * 60 * 1000;
  }, [params]);

  // ?email=<masked email> — for the "we paged the owner" line. Falls back to
  // a masked example so the screen always reads as if it knows who the user is.
  const maskedEmail = params.get("email") ?? "v•••••@cityhospital.com";

  // ?reason=<short reason> — supports a couple of canned strings; otherwise
  // we keep the wording generic per HIPAA min-necessary (don't leak which
  // password the attacker tried).
  const reason = params.get("reason") ?? "too_many_attempts";

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, unlocksAt - now);
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const unlocked = remainingMs === 0;
  const totalSeconds = (DEFAULT_LOCKOUT_MINUTES * 60);
  const pctElapsed = unlocked
    ? 100
    : Math.min(100, Math.max(0, 100 - Math.round((remainingMs / 1000 / totalSeconds) * 100)));

  return (
    <div className="space-y-7">
      <div className="space-y-2.5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-danger-soft)] text-[var(--color-danger)] ring-1 ring-inset ring-[var(--color-danger)]/20">
          <Lock className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Account temporarily locked</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          We&apos;ve paused sign-in for{" "}
          <span className="font-mono text-[var(--color-foreground)]">{maskedEmail}</span> after
          repeated unsuccessful attempts. The lock will lift automatically.
        </p>
      </div>

      {/* Countdown */}
      <div className={`rounded-2xl border p-5 ${unlocked ? "border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/30" : "border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)]/20"}`}>
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            <Clock className="size-3.5" /> {unlocked ? "Lock cleared" : "Time remaining"}
          </p>
          <ReasonChip reason={reason} />
        </div>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight">
          {unlocked ? "00:00" : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ${unlocked ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]"}`}
            style={{ width: `${pctElapsed}%` }}
          />
        </div>
        {unlocked ? (
          <p className="mt-3 text-xs text-[var(--color-success)]">
            You can try signing in again now.
          </p>
        ) : (
          <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
            Wait for the timer or use one of the options below. Trying again before the timer ends will extend the lockout.
          </p>
        )}
      </div>

      {/* Primary actions */}
      <div className="flex flex-col gap-2.5">
        <Button asChild size="lg" className="w-full" disabled={!unlocked}>
          <Link href="/login">
            Try signing in {unlocked && <ArrowRight />}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link href="/forgot-password">
            <KeyRound /> Reset password instead
          </Link>
        </Button>
      </div>

      {/* What's happening */}
      <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <ShieldAlert className="size-3.5" /> What just happened
        </p>
        <ul className="space-y-2 text-xs text-[var(--color-muted-foreground)]">
          <Bullet icon={Lock}>
            Your account hit the configured failed-attempt limit. Progressive backoff is in effect.
          </Bullet>
          <Bullet icon={ScrollText}>
            A <code className="font-mono">auth.lockout</code> event was written to the audit ledger with timestamp and source IP.
          </Bullet>
          <Bullet icon={Mail}>
            If you didn&apos;t try to sign in, contact your Organization Admin — a notification has been sent to the security log.
          </Bullet>
        </ul>
      </div>

      {/* Help */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-info-soft)] text-[var(--color-info)]">
            <RefreshCw className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Need help right now?</p>
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              Email{" "}
              <a href="mailto:security@cityhospital.com" className="font-mono text-[var(--color-primary-700)] hover:underline">
                security@cityhospital.com
              </a>{" "}
              or message your Organization Admin from another verified device.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <SecurityBadge variant="audited" />
      </div>
    </div>
  );
}

function ReasonChip({ reason }: { reason: string }) {
  const LABELS: Record<string, string> = {
    too_many_attempts: "5 failed attempts",
    mfa_failure: "MFA failures",
    suspicious: "Suspicious activity",
    admin_lock: "Locked by admin",
  };
  const label = LABELS[reason] ?? "Security policy";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted-foreground)]">
      {label}
    </span>
  );
}

function Bullet({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
      <span>{children}</span>
    </li>
  );
}
