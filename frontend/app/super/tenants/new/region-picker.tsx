"use client";

import { useState } from "react";
import { Globe, CheckCircle2 } from "lucide-react";

const REGIONS = [
  "ap-south-1 (Mumbai)",
  "us-east-1 (N. Virginia)",
  "eu-west-1 (Ireland)",
  "ap-southeast-2 (Sydney)",
];

/** Selectable region cards for the tenant-provisioning form. */
export function RegionPicker() {
  const [selected, setSelected] = useState(REGIONS[0]);

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {REGIONS.map((region) => {
        const active = region === selected;
        return (
          <button
            type="button"
            key={region}
            onClick={() => setSelected(region)}
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
            <span className="font-medium">{region}</span>
            {active && <CheckCircle2 className="ml-auto size-4 text-[var(--color-success)]" />}
          </button>
        );
      })}
    </div>
  );
}
