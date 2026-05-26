import Link from "next/link";
import { ShieldCheck, ArrowRight, Copy, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SecurityBadge } from "@/components/shared/security-badge";

interface MfaSetupProps {
  searchParams: Promise<{ required?: string; next?: string }>;
}

function safePath(p: string | undefined, fallback: string): string {
  if (p && p.startsWith("/")) return p;
  return fallback;
}

export const metadata = {
  title: "Set up two-factor",
};

export default async function MfaSetupPage({ searchParams }: MfaSetupProps) {
  const sp = await searchParams;
  const required = sp.required === "true";
  const next = safePath(sp.next, "/patient/dashboard");
  // Mandatory MFA flow lands on recovery codes after activation; optional
  // flow goes straight to the user's dashboard.
  const submitAction = required
    ? `/mfa-recovery-codes?next=${encodeURIComponent(next)}`
    : next;

  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
          Two-factor authentication
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Set up your authenticator</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {required
            ? "Required for this role. Pair an authenticator app to continue."
            : "Optional for patients, strongly recommended. Required for clinical and admin roles."}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center gap-4">
          {/* Mock QR */}
          <div className="relative grid size-32 shrink-0 grid-cols-7 gap-0.5 rounded-lg bg-white p-2 ring-1 ring-[var(--color-border)]">
            {Array.from({ length: 49 }).map((_, i) => (
              <span
                key={i}
                className={`aspect-square ${
                  (i * 7 + Math.floor(i / 7)) % 3 === 0 || i % 5 === 0
                    ? "bg-[oklch(0.18_0.025_250)]"
                    : "bg-transparent"
                } rounded-[1px]`}
              />
            ))}
            {/* Corner markers */}
            {[
              "top-1 left-1",
              "top-1 right-1",
              "bottom-1 left-1",
            ].map((p) => (
              <span key={p} className={`absolute ${p} size-6 rounded-md border-[3px] border-[oklch(0.18_0.025_250)] bg-white`}>
                <span className="absolute inset-1 rounded-sm bg-[oklch(0.18_0.025_250)]" />
              </span>
            ))}
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <p className="text-xs font-medium text-[var(--color-muted-foreground)]">Manual entry key</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded-md bg-[var(--color-muted)] px-2.5 py-1 font-mono text-xs tracking-wider">
                  JBSW Y3DP EHPK 3PXP
                </code>
                <button type="button" className="rounded-md p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
              <Smartphone className="mt-0.5 size-4 text-[var(--color-primary-700)]" />
              <span>
                Scan with Google Authenticator, Authy, 1Password, or any RFC 6238 compatible app.
              </span>
            </div>
          </div>
        </div>
      </div>

      <form className="space-y-5" action={submitAction}>
        <div className="space-y-1.5">
          <Label htmlFor="code">Enter 6-digit code to confirm</Label>
          <Input id="code" placeholder="123 456" inputMode="numeric" maxLength={7} required />
        </div>

        <Button type="submit" size="lg" className="w-full">
          Activate two-factor <ArrowRight />
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3 text-xs">
        {required ? (
          <span className="text-[var(--color-muted-foreground)]">
            Required for this role · cannot be skipped
          </span>
        ) : (
          <Link href={next} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
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
