import { PageHeader } from "@/components/shared/page-header";
import {
  NotificationsList,
  type SimpleNotification,
} from "@/components/shared/notifications-list";

const NOTIFICATIONS: SimpleNotification[] = [
  {
    id: "n1",
    category: "consent",
    title: "Break-glass session opened",
    body: "Super Admin S. Karthik opened a 30-minute break-glass session into tenant org_acme. Incident #INC-0023.",
    time: "8m ago",
    href: "/super/break-glass",
    critical: true,
  },
  {
    id: "n2",
    category: "security",
    title: "Tenant org_zenith — failed login spike",
    body: "247 failed logins in 10 minutes from 14 distinct IPs. WAF rate-limit auto-engaged.",
    time: "1h ago",
    href: "/super/security",
    critical: true,
  },
  {
    id: "n3",
    category: "system",
    title: "Worker queue · email backlog draining",
    body: "BullMQ email queue dropped from 1,840 to 220 jobs in the last 5 minutes. SendGrid quota healthy.",
    time: "2h ago",
    href: "/super/health",
  },
  {
    id: "n4",
    category: "approval",
    title: "New tenant provisioning request",
    body: "Riverside Medical Center submitted onboarding form. Pending platform-ops review.",
    time: "4h ago",
    href: "/super/tenants",
  },
  {
    id: "n5",
    category: "audit",
    title: "Audit ledger window-root rotated",
    body: "Rolling Merkle root rotated at 00:00 UTC across all tenants. Signed manifests archived.",
    time: "Yesterday",
    read: true,
  },
  {
    id: "n6",
    category: "record",
    title: "Database backup verified",
    body: "Nightly PITR restore-test succeeded. RPO 5 min, RTO 14 min — both within SLA.",
    time: "Yesterday",
    read: true,
  },
];

export default function SuperNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Platform alerts"
        description="Break-glass openings, tenant-level security signals, queue health, and onboarding requests — anything that needs platform-ops attention."
      />
      <NotificationsList items={NOTIFICATIONS} />
    </>
  );
}
