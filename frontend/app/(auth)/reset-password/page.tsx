import Link from "next/link";
import { Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SecurityBadge } from "@/components/shared/security-badge";

export default function ResetPasswordPage() {
  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
          Token verified
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Set a new password</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Choose a password you haven&apos;t used here in the last five resets.
        </p>
      </div>

      <form className="space-y-5" action="/login">
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" leadingIcon={<Lock />} placeholder="Min 12 chars" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" type="password" leadingIcon={<Lock />} placeholder="Repeat password" required />
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

        <Button type="submit" size="lg" className="w-full">
          Update password & sign out everywhere <ArrowRight />
        </Button>
      </form>

      <div className="flex justify-center">
        <SecurityBadge variant="audited" label="This action is audit-logged" />
      </div>
    </div>
  );
}
