import { ShieldOff } from "lucide-react";

/**
 * Generic empty state shown when the patient has not granted (or has
 * revoked) consent for a category the clinician is trying to view. The
 * wording is deliberately generic — the audit log captures the actual
 * reason; the UI must not leak whether the patient revoked vs never
 * granted access (HIPAA min-necessary).
 */
export function ConsentDeniedCard({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center ${className ?? ""}`}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
        <ShieldOff className="size-5" />
      </div>
      <p className="text-sm font-medium">No {category.toLowerCase()} available</p>
      <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
        You don&apos;t currently have access to this category for this patient.
        Access attempts are audit-logged.
      </p>
    </div>
  );
}
