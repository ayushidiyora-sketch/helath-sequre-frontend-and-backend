import Link from "next/link";
import { MailCheck, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

async function verifyToken(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    return data;
  } catch {
    return { ok: false, error: "Could not reach the verification service." };
  }
}

export const metadata = {
  title: "Verify your email",
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="space-y-7 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-inset ring-[var(--color-primary)]/15">
          <MailCheck className="size-7" />
        </div>
        <div className="space-y-2.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Check your inbox</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Open the verification link from your email to confirm your address.
            If you registered moments ago, the message may take a minute to
            arrive.
          </p>
        </div>
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  const result = await verifyToken(token);

  if (!result.ok) {
    return (
      <div className="space-y-7 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[var(--color-danger-soft)] text-[var(--color-danger)] ring-1 ring-inset ring-[var(--color-danger)]/15">
          <AlertCircle className="size-7" />
        </div>
        <div className="space-y-2.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Link expired or invalid</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {result.error ?? "This verification link is no longer valid. Please request a new one."}
          </p>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href="/register">Start over</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-7 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[var(--color-success-soft)] text-[var(--color-success)] ring-1 ring-inset ring-[var(--color-success)]/15">
        <CheckCircle2 className="size-7" />
      </div>
      <div className="space-y-2.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Email verified</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Thanks for confirming your address. You can now sign in to your
          HealthSecure account.
        </p>
      </div>
      <Button asChild size="lg" className="w-full">
        <Link href="/login">Continue to sign in <ArrowRight /></Link>
      </Button>
    </div>
  );
}
