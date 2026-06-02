"use client";

import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  IdCard,
  MapPin,
  Phone,
  HeartPulse,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ITEMS = [
  { icon: IdCard, label: "Aadhaar / ABHA" },
  { icon: MapPin, label: "Home address" },
  { icon: Phone, label: "Emergency contact" },
  { icon: ShieldCheck, label: "Insurance" },
  { icon: HeartPulse, label: "Allergies & history" },
];

/**
 * Dashboard sidebar nudge — "Complete your profile". Clicking the CTA now
 * routes to `/patient/settings` (the full Profile + Personal-information
 * surface that's DB-backed) instead of opening an inline modal that didn't
 * persist anywhere.
 */
export function CompleteProfileCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-primary)]/25 bg-gradient-to-br from-[var(--color-primary-50)]/60 via-[var(--color-card)] to-[var(--color-card)] p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[var(--color-primary)]/15 blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
          <Sparkles className="size-3.5" /> Optional
        </div>
        <h2 className="mt-1 text-sm font-semibold">Complete your profile</h2>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Helps your care team treat you faster. You can fill any of this
          whenever you like.
        </p>
        <ul className="mt-3 space-y-1.5">
          {ITEMS.map((it) => {
            const Icon = it.icon;
            return (
              <li
                key={it.label}
                className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]"
              >
                <Icon className="size-3.5 text-[var(--color-primary-700)]" />
                {it.label}
              </li>
            );
          })}
        </ul>
        <Button asChild size="sm" className="mt-4 w-full">
          <Link href="/patient/settings">
            Complete profile <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
