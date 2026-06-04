"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
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
import { OnboardingTour } from "@/components/shared/onboarding-tour";
import { AdminStoreProvider } from "@/lib/admin-store";

interface MeResponse {
  ok: boolean;
  user?: { name: string; email: string; role: string; org: string | null; initials: string };
}

interface TenantResponse {
  ok: boolean;
  tenant?: { name: string; type: string };
  counts?: {
    staff: number;
    clinicians: number;
    patients: number;
    departments: number;
  };
}

const UTILITY: NavItem[] = [
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [tenant, setTenant] = useState<TenantResponse["tenant"] | null>(null);
  const [counts, setCounts] = useState<TenantResponse["counts"] | null>(null);

  // Header user comes from the session — fetch once on mount.
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

  // Counts can change after every mutation (invite, deactivate, …), so
  // refetch whenever the admin navigates between pages. `usePathname`
  // changes for both push/replace and back/forward.
  const pathname = usePathname();
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/tenant", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TenantResponse | null) => {
        if (cancelled || !data?.ok) return;
        setTenant(data.tenant ?? null);
        setCounts(data.counts ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const groups: NavGroup[] = useMemo(
    () => [
      {
        label: "Operations",
        items: [
          { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/admin/users", label: "Staff", icon: Users, count: counts?.staff },
          { href: "/admin/patients", label: "Patients", icon: UserPlus2, count: counts?.patients },
          { href: "/admin/clinicians", label: "Clinicians", icon: Stethoscope, count: counts?.clinicians },
          { href: "/admin/departments", label: "Departments", icon: Building2, count: counts?.departments },
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
    ],
    [counts],
  );

  const headerUser = {
    name: me?.name ?? "—",
    subtitle: tenant?.name
      ? `${me?.role ?? "Org Admin"} · ${tenant.name}`
      : me?.role ?? "Org Admin",
    initials: me?.initials ?? "··",
    email: me?.email ?? "",
  };

  return (
    <AdminStoreProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
        <IdleTimeout />
        <OnboardingTour role="admin" />
        <RoleSidebar groups={groups} utility={UTILITY} />
        <div className="flex min-w-0 flex-1 flex-col">
          <RoleHeader
            user={headerUser}
            sessionMins={14}
            searchPlaceholder="Search users, patients, departments…"
            settingsHref="/admin/settings"
            notificationsHref="/admin/notifications"
            navGroups={groups}
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
