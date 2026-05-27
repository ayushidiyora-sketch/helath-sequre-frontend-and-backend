"use client";

import {
  LayoutDashboard,
  Users,
  UserPlus2,
  Building2,
  Calendar,
  Mail,
  Settings,
  Bell,
  BarChart3,
  Stethoscope,
  Receipt,
} from "lucide-react";
import { RoleSidebar, type NavGroup, type NavItem } from "@/components/shared/role-sidebar";
import { RoleHeader } from "@/components/shared/role-header";
import { IdleTimeout } from "@/components/shared/idle-timeout";
import { AdminStoreProvider } from "@/lib/admin-store";

const GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/users", label: "Staff", icon: Users, count: 64 },
      { href: "/admin/patients", label: "Patients", icon: UserPlus2, count: 4128 },
      { href: "/admin/clinicians", label: "Clinicians", icon: Stethoscope, count: 18 },
      { href: "/admin/departments", label: "Departments", icon: Building2, count: 7 },
      { href: "/admin/appointments", label: "Schedule", icon: Calendar },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/admin/templates", label: "Templates", icon: Mail },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/billing", label: "Billing", icon: Receipt },
      { href: "/admin/settings", label: "Organization", icon: Settings },
    ],
  },
];

const UTILITY: NavItem[] = [
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminStoreProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
        <IdleTimeout />
        <RoleSidebar groups={GROUPS} utility={UTILITY} />
        <div className="flex min-w-0 flex-1 flex-col">
          <RoleHeader
            user={{ name: "Maya Iyer", subtitle: "Org Admin · City General", initials: "MI", email: "maya.iyer@citygeneral.health" }}
            sessionMins={14}
            searchPlaceholder="Search users, patients, departments…"
            settingsHref="/admin/settings"
            notificationsHref="/admin/notifications"
            navGroups={GROUPS}
            navUtility={UTILITY}
          />
          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto space-y-6 animate-[fade-in_0.3s_ease-out]">{children}</div>
          </main>
        </div>
      </div>
    </AdminStoreProvider>
  );
}
