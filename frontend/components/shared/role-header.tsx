"use client";

import Link from "next/link";
import { Bell, ChevronDown, Settings, UserCircle2, Sun, Moon, ShieldCheck } from "lucide-react";
import { LogoutButton } from "@/components/shared/logout-button";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NavSearch, type NavSearchItem } from "@/components/shared/nav-search";
import type { NavGroup, NavItem } from "@/components/shared/role-sidebar";
import { RoleMobileNav } from "@/components/shared/role-mobile-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RoleHeader({
  user,
  sessionMins = 14,
  searchPlaceholder = "Search…",
  settingsHref,
  navGroups = [],
  navUtility = [],
}: {
  user: { name: string; subtitle: string; initials: string; email: string };
  sessionMins?: number;
  searchPlaceholder?: string;
  settingsHref: string;
  navGroups?: NavGroup[];
  navUtility?: NavItem[];
}) {
  const [dark, setDark] = useState(false);

  // Flatten the role's sidebar nav so the header search can jump to any page.
  const navItems: NavSearchItem[] = [
    ...navGroups.flatMap((g) =>
      g.items.map((i) => ({ href: i.href, label: i.label, group: g.label })),
    ),
    ...navUtility.map((i) => ({ href: i.href, label: i.label, group: "Account" })),
  ];

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <RoleMobileNav groups={navGroups} utility={navUtility} />
      <NavSearch items={navItems} placeholder={searchPlaceholder} />

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-full border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] px-2.5 py-1 text-[11px] font-medium text-[oklch(0.4_0.12_158)] dark:text-[oklch(0.85_0.12_158)] md:inline-flex">
          <ShieldCheck className="size-3.5" />
          MFA · idle in <span className="font-mono">{sessionMins}:{(sessionMins % 60).toString().padStart(2, "0").slice(0, 2)}</span>
        </div>

        <Button variant="ghost" size="icon-sm" onClick={() => setDark((v) => !v)} aria-label="Toggle theme">
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>

        <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]" aria-label="Notifications">
          <Bell className="size-4" />
          <span className="absolute right-2 top-1.5 size-2 rounded-full bg-[var(--color-danger)]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-lg p-1 pr-2 text-left hover:bg-[var(--color-muted)]">
              <Avatar className="size-8 ring-2 ring-[var(--color-card)]"><AvatarFallback>{user.initials}</AvatarFallback></Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold leading-tight">{user.name}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">{user.subtitle}</p>
              </div>
              <ChevronDown className="size-3.5 text-[var(--color-muted-foreground)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Signed in</DropdownMenuLabel>
            <div className="px-2.5 pb-2 text-xs">
              <p className="font-medium">{user.email}</p>
              <p className="text-[var(--color-muted-foreground)]">{user.subtitle}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={settingsHref}><UserCircle2 /> Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={settingsHref}><Settings /> Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <LogoutButton className="text-[var(--color-danger)] focus:bg-[var(--color-danger-soft)] focus:text-[var(--color-danger)]" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
