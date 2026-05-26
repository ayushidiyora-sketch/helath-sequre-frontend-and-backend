import Link from "next/link";
import { RegistrationWizard } from "./registration-wizard";

export const metadata = {
  title: "Create your account",
};

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <RegistrationWizard />
      <p className="text-center text-xs text-[var(--color-muted-foreground)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--color-primary-700)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
