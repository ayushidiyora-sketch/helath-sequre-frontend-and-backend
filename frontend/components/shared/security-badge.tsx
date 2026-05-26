import * as React from "react";
import { Lock, Shield, ScrollText, Eye, KeyRound, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "encrypted" | "audited" | "consent-bound" | "phi" | "mfa" | "verified";

const config: Record<Variant, { label: string; icon: React.ComponentType<{ className?: string }>; ring: string; text: string }> = {
  encrypted: {
    label: "Encrypted",
    icon: Lock,
    ring: "ring-[var(--color-success)]/30 bg-[var(--color-success-soft)]",
    text: "text-[oklch(0.4_0.12_158)] dark:text-[oklch(0.85_0.12_158)]",
  },
  audited: {
    label: "Audit-Logged",
    icon: ScrollText,
    ring: "ring-[var(--color-info)]/30 bg-[var(--color-info-soft)]",
    text: "text-[oklch(0.4_0.13_235)] dark:text-[oklch(0.85_0.13_235)]",
  },
  "consent-bound": {
    label: "Consent-Bound",
    icon: Shield,
    ring: "ring-[var(--color-primary)]/30 bg-[var(--color-primary-50)]",
    text: "text-[var(--color-primary-700)]",
  },
  phi: {
    label: "PHI",
    icon: Eye,
    ring: "ring-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]",
    text: "text-[oklch(0.4_0.12_75)] dark:text-[oklch(0.88_0.13_80)]",
  },
  mfa: {
    label: "MFA Required",
    icon: KeyRound,
    ring: "ring-[var(--color-info)]/30 bg-[var(--color-info-soft)]",
    text: "text-[oklch(0.4_0.13_235)] dark:text-[oklch(0.85_0.13_235)]",
  },
  verified: {
    label: "Verified",
    icon: FileCheck2,
    ring: "ring-[var(--color-success)]/30 bg-[var(--color-success-soft)]",
    text: "text-[oklch(0.4_0.12_158)] dark:text-[oklch(0.85_0.12_158)]",
  },
};

export function SecurityBadge({
  variant,
  className,
  label,
}: {
  variant: Variant;
  className?: string;
  label?: string;
}) {
  const c = config[variant];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        c.ring,
        c.text,
        className,
      )}
    >
      <Icon className="size-3" />
      {label ?? c.label}
    </span>
  );
}
