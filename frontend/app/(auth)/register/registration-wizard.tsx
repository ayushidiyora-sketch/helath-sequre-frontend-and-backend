"use client";

import { useState } from "react";
import Link from "next/link";
import {
  UserRound,
  Mail,
  Lock,
  Phone,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  MailCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const STEPS = ["Account type", "Your details", "Check your email"] as const;

interface FormState {
  accountType: "patient";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  password: string;
  confirmPassword: string;
  privacyConsent: boolean;
  termsAccepted: boolean;
}

const INITIAL: FormState = {
  accountType: "patient",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dob: "",
  password: "",
  confirmPassword: "",
  privacyConsent: false,
  termsAccepted: false,
};

/** Patient self-service registration. Submits to the server after Step 1,
 *  then the server dispatches the email link and SMS OTP in parallel. The
 *  flow ends on the "Check your email" step — phone OTP is completed in the
 *  verify-email tab that opens from the email link. */
export function RegistrationWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const rules = {
    length: form.password.length >= 12,
    capital: /[A-Z]/.test(form.password),
    number: /\d/.test(form.password),
    symbol: /[^A-Za-z0-9]/.test(form.password),
  };
  const passwordOk = rules.length && rules.capital && rules.number && rules.symbol;
  const passwordsMatch = form.password === form.confirmPassword;

  function canContinue(): boolean {
    switch (step) {
      case 0:
        return form.accountType === "patient";
      case 1:
        return (
          !!form.firstName.trim() &&
          !!form.lastName.trim() &&
          !!form.email.trim() &&
          !!form.phone.trim() &&
          !!form.dob &&
          passwordOk &&
          passwordsMatch &&
          form.privacyConsent &&
          form.termsAccepted
        );
      default:
        return false;
    }
  }

  async function createAccount(): Promise<boolean> {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          dob: form.dob,
          password: form.password,
          privacyConsent: form.privacyConsent,
          termsAccepted: form.termsAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        return false;
      }
      return true;
    } catch {
      setError("Network error — could not reach the server.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNext() {
    if (!canContinue()) return;

    if (step === 1) {
      const ok = await createAccount();
      if (ok) setStep(2);
      return;
    }

    setStep((s) => s + 1);
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--color-foreground)]">
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="text-[var(--color-muted-foreground)]">{STEPS[step]}</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-[var(--color-primary)]" : "bg-[var(--color-muted)]"
              }`}
            />
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ---- Step 0 · Account type ---- */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Choose the type of account you&apos;re creating.
            </p>
          </div>
          <button
            type="button"
            onClick={() => set("accountType", "patient")}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-primary-50)]/40 p-4 text-left"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.66_0.13_195)] to-[oklch(0.5_0.12_210)] text-white">
              <UserRound className="size-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">I am a Patient</p>
              <p className="text-[11px] text-[var(--color-muted-foreground)]">
                Self-service sign-up · no approval needed
              </p>
            </div>
            <CheckCircle2 className="size-5 text-[var(--color-primary)]" />
          </button>
        </div>
      )}

      {/* ---- Step 1 · Basic info ---- */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Your details</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              The basics we need to create your account.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name">
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Aarav" required />
            </Field>
            <Field label="Last name">
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Mehta" required />
            </Field>
          </div>
          <Field label="Email address">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} leadingIcon={<Mail />} placeholder="you@example.com" required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone number">
              <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} leadingIcon={<Phone />} placeholder="+91 98765 43210" required />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} leadingIcon={<Calendar />} required />
            </Field>
          </div>
          <Field label="Password">
            <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} leadingIcon={<Lock />} placeholder="At least 12 characters, mixed case, number, symbol" required />
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 pt-0.5 text-[11px]">
              <PasswordRule ok={rules.length} label="12+ characters" />
              <PasswordRule ok={rules.capital} label="One capital letter" />
              <PasswordRule ok={rules.number} label="One number" />
              <PasswordRule ok={rules.symbol} label="One symbol" />
            </ul>
          </Field>
          <Field label="Confirm password">
            <Input type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} leadingIcon={<Lock />} placeholder="Re-enter your password" required />
            {form.confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-[11px] text-[var(--color-danger)]">Passwords don&apos;t match.</p>
            )}
          </Field>
          <label className="flex items-start gap-2.5 text-xs text-[var(--color-muted-foreground)]">
            <input type="checkbox" checked={form.privacyConsent} onChange={(e) => set("privacyConsent", e.target.checked)} className="mt-0.5 size-4 rounded border-[var(--color-border)] text-[var(--color-primary)]" />
            <span>
              I have read the{" "}
              <Link href="/privacy" className="text-[var(--color-primary-700)] hover:underline">privacy notice</Link>{" "}
              and consent to my data being processed for my care.
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-xs text-[var(--color-muted-foreground)]">
            <input type="checkbox" checked={form.termsAccepted} onChange={(e) => set("termsAccepted", e.target.checked)} className="mt-0.5 size-4 rounded border-[var(--color-border)] text-[var(--color-primary)]" />
            <span>
              I accept the{" "}
              <Link href="/terms" className="text-[var(--color-primary-700)] hover:underline">Terms of Service</Link>.
            </span>
          </label>
        </div>
      )}

      {/* ---- Step 2 · Check your email ---- */}
      {step === 2 && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
            <MailCheck className="size-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Check your inbox</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              We sent a verification link to{" "}
              <span className="font-medium text-[var(--color-foreground)]">{form.email}</span>.
              Click it to confirm your email — you can keep this tab open.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3.5 text-left text-xs text-[var(--color-muted-foreground)]">
            <p className="font-medium text-[var(--color-foreground)]">Didn&apos;t get the email?</p>
            <ul className="mt-1 list-disc pl-4">
              <li>Check your spam or promotions folder.</li>
              <li>Make sure the address is correct (you can go back to edit).</li>
              <li>http://localhost:3000/verify-email?token=test-token-1234567890abcdef</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() =>
              toast.info("Verification link resent", {
                description: `Sent to ${form.email} · valid for 24 hours`,
              })
            }
            
            className="text-xs font-medium text-[var(--color-primary-700)] hover:underline"
          >
            Resend verification link
          </button>
        </div>
      )}

      {/* Footer — hidden on the terminal "Check your email" step */}
      {step !== 2 && (
        <div className="flex items-center gap-3 pt-1">
          {step > 0 && (
            <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
              <ArrowLeft /> Back
            </Button>
          )}
          <Button size="lg" className="flex-1" onClick={handleNext} disabled={!canContinue() || submitting}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" /> Creating account…
              </>
            ) : step === 1 ? (
              <>
                <Sparkles /> Create account
              </>
            ) : (
              <>
                Continue <ArrowRight />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PasswordRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? "text-[var(--color-success)]" : "text-[var(--color-muted-foreground)]"}`}>
      {ok ? <Check className="size-3" /> : <Circle className="size-3" />}
      <span>{label}</span>
    </li>
  );
}
