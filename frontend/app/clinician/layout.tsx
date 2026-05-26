"use client";

import {
  LayoutDashboard,
  Users,
  CalendarDays,
  MessageSquare,
  ClipboardList,
  Bell,
  Settings,
  FileEdit,
} from "lucide-react";
import { RoleSidebar, type NavGroup, type NavItem } from "@/components/shared/role-sidebar";
import { RoleHeader } from "@/components/shared/role-header";
import { IdleTimeout } from "@/components/shared/idle-timeout";
import { ClinicianStoreProvider } from "@/lib/clinician-store";

const GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/clinician/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/clinician/patients", label: "Patient panel", icon: Users, count: 87 },
      { href: "/clinician/schedule", label: "Schedule", icon: CalendarDays, badge: "Today" },
      { href: "/clinician/tasks", label: "Pending tasks", icon: ClipboardList, badge: "5" },
      { href: "/clinician/notes", label: "Notes editor", icon: FileEdit },
      { href: "/clinician/messages", label: "Messages", icon: MessageSquare, badge: "4" },
    ],
  },
];

const UTILITY: NavItem[] = [
  { href: "/clinician/notifications", label: "Notifications", icon: Bell },
  { href: "/clinician/settings", label: "Settings", icon: Settings },
];

export default function ClinicianLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClinicianStoreProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
        <IdleTimeout />
        <RoleSidebar groups={GROUPS} utility={UTILITY} />
        <div className="flex min-w-0 flex-1 flex-col">
          <RoleHeader
            user={{ name: "Dr. Priya Shah", subtitle: "Cardiology · City General", initials: "PS", email: "priya.shah@citygeneral.health" }}
            sessionMins={14}
            searchPlaceholder="Search patients, records, messages…"
            settingsHref="/clinician/settings"
            navGroups={GROUPS}
            navUtility={UTILITY}
          />
          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto space-y-6 animate-[fade-in_0.3s_ease-out]">{children}</div>
          </main>
        </div>
      </div>
    </ClinicianStoreProvider>
  );
}
