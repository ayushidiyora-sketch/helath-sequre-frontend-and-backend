import { CredentialsForm } from "@/components/auth/credentials-form";

export const metadata = {
  title: "Staff Sign-in",
};

export default function StaffLoginPage() {
  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
          Staff portal
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Organization staff sign-in
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          For clinicians, organization admins, compliance managers, and
          auditors using organization-provisioned credentials.
        </p>
      </div>

      <CredentialsForm scope="staff" />
    </div>
  );
}
