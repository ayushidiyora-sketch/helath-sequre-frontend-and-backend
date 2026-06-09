"use client";

import { useEffect, useState } from "react";
import { Stethoscope, Building2, ShieldCheck, Check, Loader2, type LucideIcon } from "lucide-react";
import { EditTierDialog } from "./edit-tier-dialog";
import type { SubscriptionTier } from "@/lib/tiers";

const ICONS: Record<string, LucideIcon> = {
  solo: Stethoscope,
  hospital: Building2,
  enterprise: ShieldCheck,
};

/**
 * Super Admin → Configuration → Tiers. Renders the same tier content the public
 * pricing page shows (from `subscription_tiers`); editing a card writes back and
 * updates both surfaces.
 */
export function TiersTab() {
  const [tiers, setTiers] = useState<SubscriptionTier[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tiers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j?.ok) setTiers(j.tiers as SubscriptionTier[]); else if (!cancelled) setTiers([]); })
      .catch(() => { if (!cancelled) setTiers([]); });
    return () => { cancelled = true; };
  }, []);

  if (tiers === null) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="size-4 animate-spin" /> Loading tiers…
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-3 md:items-stretch">
      {tiers.map((t) => {
        const Icon = ICONS[t.icon] ?? Stethoscope;
        return (
          <div
            key={t.id}
            className={`relative flex flex-col rounded-2xl border bg-[var(--color-card)] p-6 transition-all ${
              t.featured
                ? "border-[var(--color-primary)] shadow-[var(--shadow-lift)] ring-1 ring-[var(--color-primary)]/25"
                : "border-[var(--color-border)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
            }`}
          >
            {t.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--color-primary)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-[var(--shadow-soft)]">
                Most popular
              </span>
            )}

            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white shadow-[var(--shadow-soft)]">
                <Icon className="size-5" />
              </span>
              <p className="text-base font-semibold">{t.name}</p>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">{t.tagline}</p>

            {/* Price */}
            <div className="mt-5">
              {t.monthly !== null ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="bg-gradient-to-br from-[var(--color-foreground)] to-[var(--color-muted-foreground)] bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
                      ${t.monthly}
                    </span>
                    <span className="text-sm text-[var(--color-muted-foreground)]">/ month</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
                    {t.unit}
                    {t.annualMonthly !== null && (
                      <> · <span className="font-medium text-[var(--color-primary-700)]">${t.annualMonthly}/mo annually</span></>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-3xl font-semibold tracking-tight">Custom</div>
                  <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">{t.unit}</p>
                </>
              )}
            </div>

            {/* Features */}
            <ul className="mt-4 space-y-2 text-xs">
              {t.bullets.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--color-success)]" />
                  <span className="text-[var(--color-foreground)]">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-5">
              <EditTierDialog
                tier={t}
                onSaved={(next) => setTiers(next)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
