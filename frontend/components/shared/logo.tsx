import * as React from "react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.65_0.13_195)] to-[oklch(0.42_0.11_205)] text-white shadow-[var(--shadow-soft)] ring-1 ring-inset ring-white/20",
        className,
      )}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12h6" />
        <path d="M12 9v6" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-[var(--color-foreground)]">
          HealthSecure
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
          Portal
        </span>
      </div>
    </div>
  );
}
