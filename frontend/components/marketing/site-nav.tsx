"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Public-site nav. Renders the desktop pill nav with an active-link
 * indicator, and a mobile hamburger that slides down a panel with the
 * same nav plus auth CTAs.
 *
 * Lives next to the server `SiteHeader` so the auth check (cookies) can
 * still happen on the server while pathname-based active state stays a
 * client concern.
 */
export function SiteNav({
  items,
  authed,
  dashboardHref,
}: {
  items: NavItem[];
  authed: boolean;
  /** Where to send an authed user from the mobile menu. */
  dashboardHref?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-0.5 text-sm font-medium md:flex">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative rounded-full px-3.5 py-1.5 transition-all ${
                active
                  ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                  : "text-[var(--color-muted-foreground)] hover:-translate-y-px hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {item.label}
              {active && (
                <></>
                // <span
                //   aria-hidden
                //   className="pointer-events-none absolute left-1/2 -bottom-1 size-1 -translate-x-1/2 rounded-full bg-[var(--color-primary)]"
                // />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Hamburger (mobile only) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] md:hidden"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="size-4.5" />
      </button>

      {/* Mobile menu panel */}
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden animate-[fade-in_0.15s_ease-out]"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[var(--color-foreground)]/40 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 top-0 origin-top rounded-b-2xl border-b border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-lift)] animate-[slide-down_0.2s_ease-out]">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary-50)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
                <ShieldCheck className="size-3" /> HIPAA · SOC 2 ready
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] transition-colors hover:bg-[var(--color-muted)]"
                aria-label="Close menu"
              >
                <X className="size-4.5" />
              </button>
            </div>

            <ul className="mt-5 space-y-1">
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                          : "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
                      }`}
                    >
                      {item.label}
                      {active && <span className="size-1.5 rounded-full bg-[var(--color-primary)]" />}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 grid gap-2 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
              {authed && dashboardHref ? (
                <Button asChild size="sm" className="sm:col-span-2">
                  <Link href={dashboardHref}>Go to your dashboard <ArrowRight /></Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/register">Get started <ArrowRight /></Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
