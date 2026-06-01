import { CredentialsForm } from "@/components/auth/credentials-form";
import Link from "next/link";

export const metadata = {
  title: "Patient Sign-in",
};

export default function PatientLoginPage() {
  return (
    <div className="space-y-7">
      <div className="space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
          Patient portal
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Sign in to your health portal
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Access your medical records, appointments, consents, and secure
          messages with your care team.
        </p>
      </div>

      <CredentialsForm scope="patient" />

      <p className="text-center text-xs text-[var(--color-muted-foreground)]">
        Already have an account?{" "}
        <Link href="/register" className="font-medium text-[var(--color-primary-700)] hover:underline">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
