"use client";

import {
  LayoutDashboard,
  ScrollText,
  Shield,
  FileBarChart2,
  Database,
  Bell,
  Settings,
  AlertTriangle,
  Hourglass,
  Megaphone,
  Trash2,
} from "lucide-react";
import { RoleSidebar, type NavGroup, type NavItem } from "@/components/shared/role-sidebar";
import { RoleHeader } from "@/components/shared/role-header";
import { IdleTimeout } from "@/components/shared/idle-timeout";

const GROUPS: NavGroup[] = [
  {
    label: "Oversight",
    items: [
      { href: "/compliance/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/compliance/audit-logs", label: "Audit ledger", icon: ScrollText, count: "12.4k" },
      { href: "/compliance/anomalies", label: "Anomalies", icon: AlertTriangle, badge: "4" },
      { href: "/compliance/approvals", label: "Approvals", icon: Hourglass, badge: "3" },
      { href: "/compliance/consents", label: "Consents", icon: Shield, count: 1284 },
    ],
  },
  {
    label: "Policy",
    items: [
      { href: "/compliance/consent-policies", label: "Consent policies", icon: ScrollText },
      { href: "/compliance/campaigns", label: "Re-consent campaigns", icon: Megaphone, badge: "1" },
      { href: "/compliance/retention", label: "Retention", icon: Database },
      { href: "/compliance/deletion-requests", label: "Patient data requests", icon: Trash2, badge: "1" },
      { href: "/compliance/reports", label: "Reports", icon: FileBarChart2 },
    ],
  },
];

const UTILITY: NavItem[] = [
  { href: "/compliance/notifications", label: "Notifications", icon: Bell },
  { href: "/compliance/settings", label: "Settings", icon: Settings },
];

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <IdleTimeout />
      <RoleSidebar groups={GROUPS} utility={UTILITY} />
      <div className="flex min-w-0 flex-1 flex-col">
        <RoleHeader
          user={{ name: "Sai Compliance", subtitle: "Compliance Manager · City General", initials: "SC", email: "compliance@citygeneral.health" }}
          sessionMins={14}
          searchPlaceholder="Search audit events, policies, consents…"
          settingsHref="/compliance/settings"
          notificationsHref="/compliance/notifications"
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
