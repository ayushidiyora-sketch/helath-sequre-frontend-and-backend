"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
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
import { OnboardingTour } from "@/components/shared/onboarding-tour";
import { ClinicianStoreProvider } from "@/lib/clinician-store";
import { useMessagesUnread } from "@/lib/use-messages-unread";

interface MeResponse {
  ok: boolean;
  user?: { name: string; email: string; role: string; org: string | null; initials: string };
}

interface DashboardSummary {
  ok: boolean;
  profile?: {
    firstName: string;
    lastName: string;
    email: string;
    designation: string | null;
    department: string | null;
    tenantName: string | null;
  };
  stats?: { panelSize: number; todayCount: number };
}

const UTILITY: NavItem[] = [
  { href: "/clinician/notifications", label: "Notifications", icon: Bell },
  { href: "/clinician/settings", label: "Settings", icon: Settings },
];

export default function ClinicianLayout({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const unreadMessages = useMessagesUnread();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MeResponse | null) => {
        if (!cancelled && data?.ok) setMe(data.user ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const pathname = usePathname();
  useEffect(() => {
    let cancelled = false;
    fetch("/api/clinician/dashboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DashboardSummary | null) => {
        if (cancelled || !data?.ok) return;
        setSummary(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const groups: NavGroup[] = useMemo(
    () => [
      {
        label: "Workspace",
        items: [
          { href: "/clinician/dashboard", label: "Dashboard", icon: LayoutDashboard },
          {
            href: "/clinician/patients",
            label: "Patient panel",
            icon: Users,
            count: summary?.stats?.panelSize,
          },
          {
            href: "/clinician/schedule",
            label: "Schedule",
            icon: CalendarDays,
            badge: summary?.stats?.todayCount ? String(summary.stats.todayCount) : undefined,
          },
          { href: "/clinician/tasks", label: "Pending tasks", icon: ClipboardList },
          { href: "/clinician/notes", label: "Notes editor", icon: FileEdit },
          {
            href: "/clinician/messages",
            label: "Messages",
            icon: MessageSquare,
            badge: unreadMessages > 0 ? String(unreadMessages) : undefined,
            badgeTone: "danger" as const,
          },
        ],
      },
    ],
    [summary, unreadMessages],
  );

  const subtitle = (() => {
    if (!summary?.profile && !me) return "Clinician";
    const desigDept = [summary?.profile?.designation, summary?.profile?.department]
      .filter(Boolean)
      .join(" · ");
    const tenant = summary?.profile?.tenantName ?? me?.org ?? "";
    if (desigDept && tenant) return `${desigDept} · ${tenant}`;
    if (desigDept) return desigDept;
    if (tenant) return `${me?.role ?? "Clinician"} · ${tenant}`;
    return me?.role ?? "Clinician";
  })();

  const headerUser = {
    name: me?.name ?? "—",
    subtitle,
    initials: me?.initials ?? "··",
    email: me?.email ?? "",
  };

  return (
    <ClinicianStoreProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
        <IdleTimeout />
        <OnboardingTour role="clinician" />
        <RoleSidebar groups={groups} utility={UTILITY} />
        <div className="flex min-w-0 flex-1 flex-col">
          <RoleHeader
            user={headerUser}
            sessionMins={14}
            searchPlaceholder="Search patients, records, messages…"
            settingsHref="/clinician/settings"
            notificationsHref="/clinician/notifications"
            navGroups={groups}
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
