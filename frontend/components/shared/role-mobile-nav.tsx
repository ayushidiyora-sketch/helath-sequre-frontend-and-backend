"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { LogoutButton } from "@/components/shared/logout-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavGroup, NavItem } from "@/components/shared/role-sidebar";

/**
 * Mobile hamburger + slide-down nav drawer for role layouts. Below the
 * `lg` breakpoint the desktop sidebar is hidden — this gives mobile
 * users a way to navigate between role pages.
 */
export function RoleMobileNav({
  groups,
  utility,
}: {
  groups: NavGroup[];
  utility: NavItem[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="lg:hidden"
      >
        <Menu className="size-4" />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden animate-[fade-in_0.15s_ease-out]"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[var(--color-foreground)]/70 backdrop-blur-md"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[88vw] h-[100vh] max-w-xs flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-lift)] animate-[slide-in-left_0.2s_ease-out] sm:w-80">
            <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-4">
              <Link href="/" aria-label="HealthSecure home" onClick={() => setOpen(false)}>
                <Logo />
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <Row key={item.href} item={item} pathname={pathname} onClick={() => setOpen(false)} />
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Account
                </p>
                <div className="space-y-1">
                  {utility.map((item) => (
                    <Row key={item.href} item={item} pathname={pathname} onClick={() => setOpen(false)} />
                  ))}
                </div>
              </div>
            </nav>

            <div className="border-t border-[var(--color-border)] p-3">
              <LogoutButton className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]" />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Row({
  item,
  pathname,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onClick: () => void;
}) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
          : "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
      )}
    >
      {active && (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--color-primary)]" />
      )}
      <Icon className={cn("size-4 shrink-0", active && "text-[var(--color-primary)]")} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
            active
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
          )}
        >
          {item.badge}
        </span>
      )}
      {item.count !== undefined && !item.badge && (
        <span className="text-[10px] tabular-nums text-[var(--color-muted-foreground)]">
          {item.count}
        </span>
      )}
    </Link>
  );
}
