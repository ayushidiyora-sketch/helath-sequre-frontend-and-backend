"use client";

import Link from "next/link";
import {
  Bell,
  ShieldCheck,
  ChevronDown,
  Settings,
  UserCircle2,
  Clock,
  Sun,
  Moon,
  LayoutDashboard,
  FileText,
  Pill,
  Calendar,
  FolderLock,
  Shield,
  MessageSquare,
} from "lucide-react";
import { LogoutButton } from "@/components/shared/logout-button";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NavSearch, type NavSearchItem } from "@/components/shared/nav-search";
import { RoleMobileNav } from "@/components/shared/role-mobile-nav";
import type { NavGroup, NavItem } from "@/components/shared/role-sidebar";

/** Patient sidebar nav — kept in sync with components/patient/sidebar.tsx. */
const PATIENT_NAV: NavSearchItem[] = [
  { href: "/patient/dashboard", label: "Dashboard", group: "Workspace" },
  { href: "/patient/records", label: "Medical Records", group: "Workspace" },
  { href: "/patient/prescriptions", label: "Prescriptions", group: "Workspace" },
  { href: "/patient/appointments", label: "Appointments", group: "Workspace" },
  { href: "/patient/documents", label: "Documents", group: "Workspace" },
  { href: "/patient/consents", label: "Consents", group: "Workspace" },
  { href: "/patient/messages", label: "Messages", group: "Workspace" },
  { href: "/patient/notifications", label: "Notifications", group: "Account" },
  { href: "/patient/settings", label: "Settings", group: "Account" },
  // Personal information modules (family, emergency, insurance, vaccinations) live inside Settings now.
];

/** Drawer nav for mobile — mirrors components/patient/sidebar.tsx. */
const MOBILE_NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/patient/records", label: "Medical Records", icon: FileText },
      { href: "/patient/prescriptions", label: "Prescriptions", icon: Pill },
      { href: "/patient/appointments", label: "Appointments", icon: Calendar },
      { href: "/patient/documents", label: "Documents", icon: FolderLock },
      { href: "/patient/consents", label: "Consents", icon: Shield },
      { href: "/patient/messages", label: "Messages", icon: MessageSquare },
    ],
  },
];

const MOBILE_NAV_UTILITY: NavItem[] = [
  { href: "/patient/notifications", label: "Notifications", icon: Bell },
  { href: "/patient/settings", label: "Settings", icon: Settings },
];
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PatientHeaderUser {
  name: string;
  email: string;
  initials: string;
  tenantName: string | null;
  mrn: string;
}

export function PatientHeader() {
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState<PatientHeaderUser | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  // Presence heartbeat — bumps lastActiveAt every 60s while the tab is open
  // so the clinician's messages page shows a green-dot online indicator next
  // to this patient.
  useEffect(() => {
    const ping = () => void fetch("/api/me/heartbeat", { method: "POST", cache: "no-store" }).catch(() => {});
    ping();
    const tick = window.setInterval(ping, 60_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/patient/dashboard", { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        setUser({
          name: data.profile.name,
          email: data.profile.email,
          initials: data.profile.initials,
          tenantName: data.profile.tenantName,
          mrn: data.profile.mrn,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <RoleMobileNav groups={MOBILE_NAV_GROUPS} utility={MOBILE_NAV_UTILITY} />
      <NavSearch items={PATIENT_NAV} placeholder="Search records, appointments, messages…" />

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-full border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] px-2.5 py-1 text-[11px] font-medium text-[oklch(0.4_0.12_158)] dark:text-[oklch(0.85_0.12_158)] md:inline-flex">
          <ShieldCheck className="size-3.5" />
          Session secured · idle in <span className="font-mono">27:14</span>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setDark((v) => !v)}
          aria-label="Toggle theme"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>

        <Link
          href="/patient/notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          <span className="absolute right-2 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-danger)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-danger)]" />
          </span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-lg p-1 pr-2 text-left hover:bg-[var(--color-muted)]">
              <Avatar className="size-8 ring-2 ring-[var(--color-card)]">
                <AvatarFallback>{user?.initials ?? "··"}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold leading-tight">{user?.name ?? "—"}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">
                  Patient{user?.tenantName ? ` · ${user.tenantName}` : ""}
                </p>
              </div>
              <ChevronDown className="size-3.5 text-[var(--color-muted-foreground)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Signed in</DropdownMenuLabel>
            <div className="px-2.5 pb-2 text-xs">
              <p className="font-medium">{user?.email ?? "—"}</p>
              <p className="text-[var(--color-muted-foreground)]">MRN · {user?.mrn ?? "—"}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/patient/settings"><UserCircle2 /> Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/patient/settings"><Settings /> Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Clock /> Active sessions
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
