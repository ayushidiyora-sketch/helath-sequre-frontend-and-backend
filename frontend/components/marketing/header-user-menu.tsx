"use client";

import Link from "next/link";
import { ChevronDown, LayoutDashboard } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogoutButton } from "@/components/shared/logout-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderUserMenuProps {
  name: string;
  email: string;
  role: string;
  dashboardHref: string;
}

/** Signed-in user chip + dropdown for the public site header. */
export function HeaderUserMenu({ name, email, role, dashboardHref }: HeaderUserMenuProps) {
  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2.5 rounded-lg p-1 pr-2 text-left hover:bg-[var(--color-muted)]">
          <Avatar className="size-8 ring-2 ring-[var(--color-card)]">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold leading-tight">{name}</p>
            <p className="text-[10px] text-[var(--color-muted-foreground)]">{role}</p>
          </div>
          <ChevronDown className="size-3.5 text-[var(--color-muted-foreground)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Signed in</DropdownMenuLabel>
        <div className="px-2.5 pb-2 text-xs">
          <p className="font-medium">{email}</p>
          <p className="text-[var(--color-muted-foreground)]">{role}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={dashboardHref}>
            <LayoutDashboard /> Go to dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <LogoutButton className="text-[var(--color-danger)] focus:bg-[var(--color-danger-soft)] focus:text-[var(--color-danger)]" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
