import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Subscription tiers — the single source of truth shared by the public
 * marketing pricing page and the Super Admin → Configuration → Tiers editor.
 * Stored in `subscription_tiers`; editing a tier in Super Admin updates what
 * the marketing site shows.
 */
export interface SubscriptionTier {
  id: string;
  name: string;
  tagline: string;
  /** "solo" | "hospital" | "enterprise" — drives the icon on both surfaces. */
  icon: string;
  /** Monthly price; null = "Custom" (talk to sales). */
  monthly: number | null;
  annualMonthly: number | null;
  unit: string;
  ctaLabel: string;
  ctaHref: string;
  featured: boolean;
  bullets: string[];
  sortOrder: number;
}

interface Row {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  monthly: number | null;
  annualMonthly: number | null;
  unit: string;
  ctaLabel: string;
  ctaHref: string;
  featured: boolean;
  bullets: Prisma.JsonValue;
  sortOrder: number;
}

function toTier(r: Row): SubscriptionTier {
  return {
    id: r.id,
    name: r.name,
    tagline: r.tagline,
    icon: r.icon,
    monthly: r.monthly,
    annualMonthly: r.annualMonthly,
    unit: r.unit,
    ctaLabel: r.ctaLabel,
    ctaHref: r.ctaHref,
    featured: r.featured,
    bullets: Array.isArray(r.bullets) ? (r.bullets as string[]) : [],
    sortOrder: r.sortOrder,
  };
}

/** All tiers, ordered for display. Used by the marketing page + tiers API. */
export async function getTiers(): Promise<SubscriptionTier[]> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, name, tagline, icon, monthly, "annualMonthly", unit,
           "ctaLabel", "ctaHref", featured, bullets, "sortOrder"
    FROM subscription_tiers
    ORDER BY "sortOrder" ASC
  `;
  return rows.map(toTier);
}
