import { ShieldAlert } from "lucide-react";
import { CredentialsForm } from "@/components/auth/credentials-form";

export const metadata = {
  title: "Operator Sign-in",
  robots: { index: false, follow: false },
};

export default function SuperLoginPage() {
  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
          Platform console
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Operator sign-in
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Cross-tenant platform operations for authorized Sensussoft personnel.
        </p>
      </div>

      {/* Restricted-access note */}
      {/* <div className="flex items-start gap-3 rounded-xl border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)]/50 p-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-danger)]/15 text-[var(--color-danger)]">
          <ShieldAlert className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Restricted area</p>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            Authorized personnel only. Access attempts are logged, IP-checked,
            and audited with elevated retention.
          </p>
        </div>
      </div> */}

      <CredentialsForm
        scope="super"
        demoAccounts={[["Super Admin", "riya.sen@sensussoft.com"]]}
      />
    </div>
  );
}
