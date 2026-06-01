"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface Branding {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

const DEFAULT: Branding = {
  logoUrl: "",
  primaryColor: "#0E7490",
  secondaryColor: "#FFFFFF",
};

interface BrandingContextValue {
  branding: Branding;
  /** Apply colors immediately (optimistic) without hitting the API. */
  applyBranding: (patch: Partial<Branding>) => void;
  /** Re-fetch branding from the server. */
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

/** Convert "#rrggbb" -> "r, g, b" so we can build rgba() variants. */
function hexToRgbTuple(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "14, 116, 144";
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/**
 * Apply branding colors as CSS variables on the document root. Overrides the
 * teal defaults from globals.css so the whole portal picks up the tenant's
 * brand. We override the most-used primary tokens (`--color-primary`,
 * `--color-primary-600`, `--color-primary-700`) with the chosen hex, and
 * derive the lighter surfaces (`--color-primary-50`, `--color-primary-100`)
 * via `color-mix` against white so they stay subtle.
 */
function applyToDocument(branding: Branding) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const primary = branding.primaryColor || DEFAULT.primaryColor;
  const rgb = hexToRgbTuple(primary);
  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-primary-600", primary);
  root.style.setProperty("--color-primary-700", primary);
  root.style.setProperty("--color-primary-500", primary);
  // Soft surfaces derived from the primary so cards and badges still look right.
  root.style.setProperty("--color-primary-50", `rgba(${rgb}, 0.08)`);
  root.style.setProperty("--color-primary-100", `rgba(${rgb}, 0.14)`);
  root.style.setProperty("--color-primary-200", `rgba(${rgb}, 0.22)`);
  // Keep --color-primary-foreground as-is from globals.css since it depends on
  // dark/light mode. Most brand colors are dark enough that white text on top
  // continues to work.
}

export function BrandingThemeProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/branding", { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      if (!data?.ok) return;
      const next: Branding = {
        logoUrl: data.branding?.logoUrl ?? "",
        primaryColor: data.branding?.primaryColor || DEFAULT.primaryColor,
        secondaryColor: data.branding?.secondaryColor || DEFAULT.secondaryColor,
      };
      setBranding(next);
      applyToDocument(next);
    } catch {
      // silent — fall back to default theme already in CSS
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyBranding = useCallback((patch: Partial<Branding>) => {
    setBranding((prev) => {
      const next = { ...prev, ...patch };
      applyToDocument(next);
      return next;
    });
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, applyBranding, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    // Allow consumers outside the provider to render with defaults rather than
    // throwing — the marketing site, for example, may not mount the provider.
    return {
      branding: DEFAULT,
      applyBranding: () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
