"use client";

import { useEffect, useState } from "react";
import { KeyRound, Clock, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";
import { NotificationPreferences } from "@/components/shared/notification-preferences";
import { LoginOtpToggle } from "@/components/shared/login-otp-toggle";

interface AuditorProfile {
  name: string;
  email: string;
  organization: string;
  scope: string;
  accountExpiresLabel: string;
  mfaEnrolled: boolean;
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
  sessionIpAllowlist: string | null;
  sessionExpiresAt: string | null;
}

export default function AuditorSettings() {
  const [profile, setProfile] = useState<AuditorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auditor/profile", { cache: "no-store" });
        const j = await r.json();
        if (!alive || !j?.ok) return;
        setProfile(j.profile as AuditorProfile);
      } catch (err) {
        console.error("[auditor/settings] fetch", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Auditor account"
        description="Limited surface. Your account is time-bounded by the assignment window."
      />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
        <h3 className="text-sm font-semibold">Profile</h3>
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 className="size-4 animate-spin" /> Loading profile…
          </p>
        ) : !profile ? (
          <p className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">Profile unavailable.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={profile.name} readOnly className="bg-[var(--color-muted)]" />
            </div>
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Input value={profile.organization} readOnly className="bg-[var(--color-muted)]" />
            </div>
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Input value={profile.scope} readOnly className="bg-[var(--color-muted)] font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Account expires</Label>
              <Input value={profile.accountExpiresLabel} readOnly className="bg-[var(--color-muted)]" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Email</Label>
              <Input value={profile.email} readOnly className="bg-[var(--color-muted)] font-mono" />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-3">
        <h3 className="text-sm font-semibold">Security</h3>

        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-4">
          <KeyRound className={`size-5 ${profile?.mfaEnrolled ? "text-[var(--color-primary-700)]" : "text-[var(--color-muted-foreground)]"}`} />
          <div className="flex-1">
            <p className="text-sm font-medium">{profile?.mfaEnrolled ? "TOTP enrolled" : "TOTP not enrolled"}</p>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              {profile?.sessionIpAllowlist
                ? `Last session IP · ${profile.sessionIpAllowlist}`
                : profile?.mfaRequired
                  ? "MFA required by tenant policy"
                  : "MFA optional for this account"}
            </p>
          </div>
          {profile?.mfaEnrolled ? (
            <Badge variant="success" size="sm" dot>Active</Badge>
          ) : (
            <Badge variant="warning" size="sm" dot>Pending</Badge>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-4">
          <Clock className="size-5 text-[var(--color-muted-foreground)]" />
          <div className="flex-1">
            <p className="text-sm font-medium">Session timeout</p>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              {profile?.sessionTimeoutMinutes ?? 15} minutes idle · enforced by tenant policy
              {profile?.sessionExpiresAt
                ? ` · current session ends ${new Date(profile.sessionExpiresAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}`
                : ""}
            </p>
          </div>
          <Button variant="ghost" size="sm" disabled>Locked</Button>
        </div>
      </div>

      <LoginOtpToggle />

      <ChangePasswordCard />

      <NotificationPreferences role="auditor" />

      <SecurityBadge variant="audited" />
    </>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function clientCheck(): string | null {
    if (!current) return "Enter your current password.";
    if (next.length < 12) return "New password must be at least 12 characters.";
    if (!/[A-Z]/.test(next)) return "New password must include an uppercase letter.";
    if (!/[a-z]/.test(next)) return "New password must include a lowercase letter.";
    if (!/[0-9]/.test(next)) return "New password must include a digit.";
    if (!/[^A-Za-z0-9]/.test(next)) return "New password must include a symbol.";
    if (current === next) return "New password must be different from your current one.";
    if (next !== confirm) return "New password and confirmation must match.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = clientCheck();
    if (err) { toast.warning(err); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        toast.error(j?.error ?? "Could not change password");
        return;
      }
      toast.success("Password updated · audit-logged", { description: "Your existing session stays signed in." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch {
      toast.error("Network error — please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary)]/20">
          <Lock className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">Change password</h3>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            12+ characters with upper, lower, digit, and symbol. The change is audit-logged; your existing session stays signed in.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="current-pw">Current password</Label>
          <PasswordField id="current-pw" value={current} onChange={setCurrent} visible={showCurrent} onToggle={() => setShowCurrent((v) => !v)} autoComplete="current-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-pw">New password</Label>
          <PasswordField id="new-pw" value={next} onChange={setNext} visible={showNext} onToggle={() => setShowNext((v) => !v)} autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-pw">Confirm new password</Label>
          <PasswordField id="confirm-pw" value={confirm} onChange={setConfirm} visible={showNext} onToggle={() => setShowNext((v) => !v)} autoComplete="new-password" />
        </div>
      </div>

      <PasswordStrengthHints pw={next} />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-[var(--color-muted-foreground)]">
          Password changes are recorded against your session id in the audit ledger.
        </span>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Lock />}
          Update password
        </Button>
      </div>
    </form>
  );
}

function PasswordField({
  id,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function PasswordStrengthHints({ pw }: { pw: string }) {
  const checks = [
    { ok: pw.length >= 12, label: "12+ characters" },
    { ok: /[A-Z]/.test(pw), label: "Uppercase letter" },
    { ok: /[a-z]/.test(pw), label: "Lowercase letter" },
    { ok: /[0-9]/.test(pw), label: "Digit" },
    { ok: /[^A-Za-z0-9]/.test(pw), label: "Symbol" },
  ];
  return (
    <ul className="grid grid-cols-2 gap-1.5 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/20 p-3 sm:grid-cols-5">
      {checks.map((c) => (
        <li
          key={c.label}
          className={`flex items-center gap-1.5 text-[11px] ${c.ok ? "text-[var(--color-success)]" : "text-[var(--color-muted-foreground)]"}`}
        >
          <span className={`inline-block size-1.5 rounded-full ${c.ok ? "bg-[var(--color-success)]" : "bg-[var(--color-muted-foreground)]/50"}`} />
          {c.label}
        </li>
      ))}
    </ul>
  );
}
