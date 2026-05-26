import { CheckCircle2, ArrowRight, Building2, Lock, Mail, Stethoscope, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SecurityBadge } from "@/components/shared/security-badge";

type InviteRole = "patient" | "clinician" | "staff";

interface InvitePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    role?: string;
    email?: string;
    hospital?: string;
    clinician?: string;
    name?: string;
  }>;
}

function parseRole(raw: string | undefined): InviteRole {
  if (raw === "clinician" || raw === "staff") return raw;
  return "patient";
}

function roleLabel(role: InviteRole): string {
  if (role === "clinician") return "Clinician";
  if (role === "staff") return "Staff member";
  return "Patient";
}

/** Where the accept-invitation form posts to. Mandatory MFA roles go through
 *  /mfa-setup with required=true; patients go through the optional prompt. */
function acceptAction(role: InviteRole): string {
  if (role === "clinician") {
    return "/mfa-setup?required=true&next=" + encodeURIComponent("/clinician/dashboard");
  }
  if (role === "staff") {
    return "/mfa-setup?required=true&next=" + encodeURIComponent("/admin/dashboard");
  }
  return "/mfa-prompt?next=" + encodeURIComponent("/patient/dashboard");
}

export const metadata = {
  title: "Accept invitation",
};

export default async function InvitationAcceptPage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const sp = await searchParams;

  const role = parseRole(sp.role);
  const email = sp.email ?? "aarav.mehta@example.com";
  const hospital = sp.hospital ?? "City General Hospital";
  const clinician = sp.clinician ?? "Dr. Priya Shah · Cardiology";
  const isPatient = role === "patient";

  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
          Invitation
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {isPatient ? "Accept your clinic invitation" : "Accept your staff invitation"}
        </h1>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)] text-white">
            <Building2 className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">{hospital}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              invited you as a{" "}
              <span className="font-medium text-[var(--color-foreground)]">{roleLabel(role)}</span>
            </p>
          </div>
          <SecurityBadge variant="verified" className="ml-auto" />
        </div>
        <div className="space-y-2 p-4 text-xs">
          {isPatient && (
            <div className="flex justify-between gap-3">
              <span className="text-[var(--color-muted-foreground)]">Default clinician</span>
              <span className="font-medium inline-flex items-center gap-1">
                <Stethoscope className="size-3.5" /> {clinician}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">Token expires</span>
            <span className="font-mono">in 7 days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">Token</span>
            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]" title={token}>
              {token.slice(0, 8)}…
            </span>
          </div>
          {isPatient && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">Consent policy</span>
              <span className="font-medium">v2.4 — reviewed before activation</span>
            </div>
          )}
          {!isPatient && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">MFA</span>
              <span className="inline-flex items-center gap-1 font-medium text-[var(--color-foreground)]">
                <ShieldCheck className="size-3.5 text-[var(--color-success)]" /> Mandatory
              </span>
            </div>
          )}
        </div>
      </div>

      <form className="space-y-5" action={acceptAction(role)}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email (read-only)</Label>
          <Input
            id="email"
            type="email"
            defaultValue={email}
            readOnly
            leadingIcon={<Mail />}
            className="bg-[var(--color-muted)]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pw">Set a password</Label>
          <Input
            id="pw"
            type="password"
            leadingIcon={<Lock />}
            placeholder="12+ chars · capital · number · symbol"
            required
          />
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            Must include 12+ characters with one capital letter, one number,
            and one symbol.
          </p>
        </div>

        {isPatient && (
          <label className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-xs text-[var(--color-muted-foreground)]">
            <input
              type="checkbox"
              required
              className="mt-0.5 size-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
            />
            <span>
              I accept consent policy{" "}
              <span className="font-medium text-[var(--color-foreground)]">v2.4</span> and authorize{" "}
              {clinician.split("·")[0].trim()} to access <em>lab reports, prescriptions, imaging,</em>{" "}
              and <em>clinical notes</em>. I can revoke any scope at any time from the consent
              page.
            </span>
          </label>
        )}

        {!isPatient && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-xs text-[var(--color-muted-foreground)]">
            <p className="font-medium text-[var(--color-foreground)]">Next: authenticator app</p>
            <p className="mt-0.5">
              After setting your password you&apos;ll pair an authenticator app
              and receive recovery codes. Both are required for{" "}
              {roleLabel(role).toLowerCase()} accounts.
            </p>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full">
          {isPatient ? "Accept invitation & continue" : "Continue to MFA setup"}{" "}
          <ArrowRight />
        </Button>
      </form>

      <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-muted-foreground)]">
        <CheckCircle2 className="size-3.5 text-[var(--color-success)]" />
        Token signature verified · single-use · expires in 7 days
      </div>
    </div>
  );
}
