import Link from "next/link";
import { Mail, ArrowRight, ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reset your password</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          We&apos;ll send a signed, time-limited link to the verified email on file.
          The link expires after 30 minutes.
        </p>
      </div>

      <form className="space-y-5" action="/reset-password">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" placeholder="you@example.com" leadingIcon={<Mail />} required />
        </div>

        <Button type="submit" size="lg" className="w-full">
          Send reset link <ArrowRight />
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
