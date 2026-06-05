"use client";

import { Clock } from "lucide-react";

/** Duration presets in hours; `null` = open-ended (until revoked). */
const OPTIONS: { label: string; sub: string; hours: number | null }[] = [
  { label: "24 hours", sub: "Auto-expire", hours: 24 },
  { label: "7 days", sub: "Auto-expire", hours: 24 * 7 },
  { label: "30 days", sub: "Auto-expire", hours: 24 * 30 },
  { label: "90 days", sub: "Auto-expire", hours: 24 * 90 },
  { label: "6 months", sub: "Auto-expire", hours: 24 * 182 },
  { label: "Open-ended", sub: "Until revoked", hours: null },
];

function expiryLabel(hours: number): string {
  const d = new Date(Date.now() + hours * 3_600_000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Controlled consent-duration picker. Emits the selected duration in hours
 * (or `null` for open-ended) so the grant flow can persist a real time-bound
 * consent with a server-computed expiry.
 */
export function DurationPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (hours: number | null) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((d) => {
          const active = d.hours === value;
          return (
            <button
              key={d.label}
              type="button"
              onClick={() => onChange(d.hours)}
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
      <p className="text-xs text-[var(--color-muted-foreground)]">
        {value === null
          ? "Stays active until you revoke it."
          : `Expires automatically on ${expiryLabel(value)} · access is denied after that.`}
      </p>
    </div>
  );
}
