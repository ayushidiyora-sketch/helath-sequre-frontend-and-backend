"use client";

import { LayoutDashboard, ScrollText, Shield, FileBarChart2, Settings, Bell } from "lucide-react";
import { RoleSidebar, type NavGroup, type NavItem } from "@/components/shared/role-sidebar";
import { RoleHeader } from "@/components/shared/role-header";
import { IdleTimeout } from "@/components/shared/idle-timeout";

const GROUPS: NavGroup[] = [
  {
    label: "Read-only access",
    items: [
      { href: "/auditor/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/auditor/audit-logs", label: "Audit ledger", icon: ScrollText, count: "12.4k" },
      { href: "/auditor/consents", label: "Consent records", icon: Shield },
      { href: "/auditor/reports", label: "Reports", icon: FileBarChart2 },
    ],
  },
];

const UTILITY: NavItem[] = [
  { href: "/auditor/notifications", label: "Notifications", icon: Bell },
  { href: "/auditor/settings", label: "Settings", icon: Settings },
];

export default function AuditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <IdleTimeout />
      <RoleSidebar groups={GROUPS} utility={UTILITY} />
      <div className="flex min-w-0 flex-1 flex-col">
        <RoleHeader
          user={{ name: "Anand Verma", subtitle: "External Auditor · regulator.gov", initials: "AV", email: "anand.verma@regulator.gov" }}
          sessionMins={14}
          searchPlaceholder="Search audit events…"
          settingsHref="/auditor/settings"
          notificationsHref="/auditor/notifications"
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
