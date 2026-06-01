"use client";

import { Globe, CheckCircle2 } from "lucide-react";

const REGIONS: { id: string; label: string }[] = [
  { id: "ap-south-1", label: "ap-south-1 (Mumbai)" },
  { id: "us-east-1", label: "us-east-1 (N. Virginia)" },
  { id: "eu-west-1", label: "eu-west-1 (Ireland)" },
  { id: "ap-southeast-2", label: "ap-southeast-2 (Sydney)" },
];

interface RegionPickerProps {
  value: string;
  onChange: (id: string) => void;
}

/** Selectable region cards for the tenant-provisioning form. Controlled. */
export function RegionPicker({ value, onChange }: RegionPickerProps) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {REGIONS.map((region) => {
        const active = region.id === value;
        return (
          <button
            type="button"
            key={region.id}
            onClick={() => onChange(region.id)}
            aria-pressed={active}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${
              active
                ? "border-[var(--color-primary)] bg-[var(--color-primary-50)]/40"
                : "border-[var(--color-border)] hover:bg-[var(--color-muted)]/30"
            }`}
          >
            <Globe
              className={`size-4 ${active ? "text-[var(--color-primary-700)]" : "text-[var(--color-muted-foreground)]"}`}
            />
            <span className="font-medium">{region.label}</span>
            {active && <CheckCircle2 className="ml-auto size-4 text-[var(--color-success)]" />}
          </button>
        );
      })}
    </div>
  );
}
