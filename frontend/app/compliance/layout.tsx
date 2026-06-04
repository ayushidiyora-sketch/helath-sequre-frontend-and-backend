"use client";

import { useEffect, useState } from "react";
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
import { OnboardingTour } from "@/components/shared/onboarding-tour";

interface MeResponse {
  ok: boolean;
  user?: { uid: string; name: string; email: string; role: string; org: string | null; initials: string };
}

const UTILITY: NavItem[] = [
  { href: "/compliance/notifications", label: "Notifications", icon: Bell },
  { href: "/compliance/settings", label: "Settings", icon: Settings },
];

/** Compact format: 1234 → "1.2k", 12489 → "12.5k", 0 → "0". */
function compactCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`.replace(".0k", "k");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0M", "M");
}

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [auditCount, setAuditCount] = useState<string | undefined>(undefined);
  const [consentsCount, setConsentsCount] = useState<number | undefined>(undefined);
  const [requestsBadge, setRequestsBadge] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MeResponse | null) => {
        if (!cancelled && data?.ok) setMe(data.user ?? null);
      })
      .catch(() => {});
    // Live counts so the sidebar reflects this tenant instead of a hardcoded
    // "12.4k" / "1284". Both endpoints respect the Compliance + Auditor gate.
    fetch("/api/compliance/audit-logs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; stats?: { events24h?: number } } | null) => {
        if (!cancelled && data?.ok && typeof data.stats?.events24h === "number") {
          setAuditCount(compactCount(data.stats.events24h));
        }
      })
      .catch(() => {});
    fetch("/api/compliance/consents", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; stats?: { active?: number } } | null) => {
        if (!cancelled && data?.ok && typeof data.stats?.active === "number") {
          setConsentsCount(data.stats.active);
        }
      })
      .catch(() => {});
    fetch("/api/compliance/retention", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; openRequestsCount?: number } | null) => {
        if (!cancelled && data?.ok && typeof data.openRequestsCount === "number") {
          setRequestsBadge(data.openRequestsCount > 0 ? String(data.openRequestsCount) : undefined);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const GROUPS: NavGroup[] = [
    {
      label: "Oversight",
      items: [
        { href: "/compliance/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/compliance/audit-logs", label: "Audit ledger", icon: ScrollText, count: auditCount },
        { href: "/compliance/anomalies", label: "Anomalies", icon: AlertTriangle, badge: "4" },
        { href: "/compliance/approvals", label: "Approvals", icon: Hourglass, badge: "3" },
        { href: "/compliance/consents", label: "Consents", icon: Shield, count: consentsCount },
      ],
    },
    {
      label: "Policy",
      items: [
        { href: "/compliance/consent-policies", label: "Consent policies", icon: ScrollText },
        { href: "/compliance/campaigns", label: "Re-consent campaigns", icon: Megaphone, badge: "1" },
        { href: "/compliance/retention", label: "Retention", icon: Database },
        { href: "/compliance/deletion-requests", label: "Patient data requests", icon: Trash2, badge: requestsBadge },
        { href: "/compliance/reports", label: "Reports", icon: FileBarChart2 },
      ],
    },
  ];

  const user = me
    ? {
        name: me.name,
        subtitle: me.org ? `${me.role} · ${me.org}` : me.role,
        initials: me.initials,
        email: me.email,
      }
    : { name: "Loading…", subtitle: "Compliance Manager", initials: "··", email: "" };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <IdleTimeout />
      <OnboardingTour role="compliance" />
      <RoleSidebar groups={GROUPS} utility={UTILITY} />
      <div className="flex min-w-0 flex-1 flex-col">
        <RoleHeader
          user={user}
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
