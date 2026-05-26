"use client";

import { useState } from "react";
import { Clock } from "lucide-react";

const OPTIONS = [
  { label: "30 days", sub: "Auto-expire" },
  { label: "6 months", sub: "Auto-expire" },
  { label: "Open-ended", sub: "Until revoked" },
];

/** Selectable consent-duration cards for the grant flow. */
export function DurationPicker() {
  const [selected, setSelected] = useState(2);

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {OPTIONS.map((d, i) => {
        const active = i === selected;
        return (
          <button
            key={d.label}
            type="button"
            onClick={() => setSelected(i)}
            aria-pressed={active}
            className={`rounded-xl border p-3 text-left transition-colors ${
              active
                ? "border-[var(--color-primary)] bg-[var(--color-primary-50)]/40"
                : "border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)]/30"
            }`}
          >
            <Clock
              className={`mb-1.5 size-4 ${active ? "text-[var(--color-primary-700)]" : "text-[var(--color-muted-foreground)]"}`}
            />
            <p className="text-sm font-semibold">{d.label}</p>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">{d.sub}</p>
          </button>
        );
      })}
    </div>
  );
}
