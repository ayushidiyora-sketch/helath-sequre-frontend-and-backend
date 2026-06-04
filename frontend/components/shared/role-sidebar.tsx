"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/shared/logo";
import { LogoutButton } from "@/components/shared/logout-button";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  /** Visual tone for the badge. "danger" → red pill (unread message count). */
  badgeTone?: "default" | "danger";
  count?: string | number;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export function RoleSidebar({
  groups,
  utility,
}: {
  groups: NavGroup[];
  utility: NavItem[];
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]/60 backdrop-blur lg:flex">
      <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-5">
        <Link href="/" aria-label="HealthSecure home">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-tour={`nav-${item.href.split("/").pop()}`}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      active
                        ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                        : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--color-primary)]" />
                    )}
                    <Icon className={cn("size-4 shrink-0", active && "text-[var(--color-primary)]")} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className={cn(
                        "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                        item.badgeTone === "danger"
                          ? "bg-[var(--color-danger)] text-white"
                          : active ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] group-hover:bg-[var(--color-card)]",
                      )}>
                        {item.badge}
                      </span>
                    )}
                    {item.count !== undefined && !item.badge && (
                      <span className="text-[10px] tabular-nums text-[var(--color-muted-foreground)]">{item.count}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Account</p>
          <div className="space-y-1">
            {utility.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    active
                      ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                      : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-[var(--color-border)] p-3">
        <LogoutButton className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]" />
      </div>
    </aside>
  );
}
