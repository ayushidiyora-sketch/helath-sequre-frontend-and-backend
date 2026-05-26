"use client";

import {
  LayoutDashboard,
  Building2,
  ShieldAlert,
  Settings,
  Bell,
  Activity,
  Flame,
  Plug,
  AlertCircle,
} from "lucide-react";
import { RoleSidebar, type NavGroup, type NavItem } from "@/components/shared/role-sidebar";
import { RoleHeader } from "@/components/shared/role-header";
import { IdleTimeout } from "@/components/shared/idle-timeout";

const GROUPS: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { href: "/super/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/super/tenants", label: "Tenants", icon: Building2, count: 18 },
      { href: "/super/platform", label: "Configuration", icon: Plug },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/super/health", label: "Health & status", icon: Activity },
      { href: "/super/security", label: "Security stream", icon: ShieldAlert, badge: "2" },
      { href: "/super/incidents", label: "Incidents", icon: AlertCircle },
      { href: "/super/break-glass", label: "Break-glass", icon: Flame },
    ],
  },
];

const UTILITY: NavItem[] = [
  { href: "/super/notifications", label: "Notifications", icon: Bell },
  { href: "/super/settings", label: "Settings", icon: Settings },
];

export default function SuperLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <IdleTimeout />
      <RoleSidebar groups={GROUPS} utility={UTILITY} />
      <div className="flex min-w-0 flex-1 flex-col">
        <RoleHeader
          user={{ name: "Riya Sen", subtitle: "Super Admin · Sensussoft", initials: "RS", email: "riya.sen@sensussoft.com" }}
          sessionMins={9}
          searchPlaceholder="Search tenants, incidents, security events…"
          settingsHref="/super/settings"
          navGroups={GROUPS}
          navUtility={UTILITY}
        />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto space-y-6 animate-[fade-in_0.3s_ease-out]">{children}</div>
        </main>
      </div>
    </div>
  );
}
