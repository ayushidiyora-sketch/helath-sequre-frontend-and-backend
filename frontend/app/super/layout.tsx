"use client";

import { useEffect, useMemo, useState } from "react";
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

interface MeResponse {
  ok: boolean;
  user?: { uid: string; name: string; email: string; role: string; org: string | null; initials: string };
}

const UTILITY: NavItem[] = [
  { href: "/super/notifications", label: "Notifications", icon: Bell },
  { href: "/super/settings", label: "Settings", icon: Settings },
];

export default function SuperLayout({ children }: { children: React.ReactNode }) {
  const [tenantCount, setTenantCount] = useState<number | undefined>(undefined);
  const [me, setMe] = useState<MeResponse["user"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/super/tenants")
      .then((r) => (r.ok ? r.json() : { tenants: [] }))
      .then((data: { tenants?: { id: string }[] }) => {
        if (!cancelled) setTenantCount(data.tenants?.length ?? 0);
      })
      .catch(() => {
        /* leave count undefined; sidebar omits the badge */
      });
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

  const groups: NavGroup[] = useMemo(
    () => [
      {
        label: "Platform",
        items: [
          { href: "/super/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/super/tenants", label: "Tenants", icon: Building2, count: tenantCount },
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
    ],
    [tenantCount],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <IdleTimeout />
      <RoleSidebar groups={groups} utility={UTILITY} />
      <div className="flex min-w-0 flex-1 flex-col">
        <RoleHeader
          user={
            me
              ? {
                  name: me.name,
                  subtitle: me.org ? `${me.role} · ${me.org}` : me.role,
                  initials: me.initials,
                  email: me.email,
                }
              : { name: "Loading…", subtitle: "Super Admin", initials: "··", email: "" }
          }
          sessionMins={9}
          searchPlaceholder="Search tenants, incidents, security events…"
          settingsHref="/super/settings"
          notificationsHref="/super/notifications"
          navGroups={groups}
          navUtility={UTILITY}
        />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto space-y-6 animate-[fade-in_0.3s_ease-out]">{children}</div>
        </main>
      </div>
    </div>
  );
}
