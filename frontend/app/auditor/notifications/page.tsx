import { PageHeader } from "@/components/shared/page-header";
import {
  NotificationsList,
  type SimpleNotification,
} from "@/components/shared/notifications-list";

const NOTIFICATIONS: SimpleNotification[] = [
  {
    id: "n1",
    category: "audit",
    title: "Audit window expires in 48 hours",
    body: "Your read-only audit grant for org_acme expires on May 28. Export anything you need before it lapses.",
    time: "2h ago",
    href: "/auditor/audit-logs",
  },
  {
    id: "n2",
    category: "security",
    title: "MFA challenge from new IP",
    body: "An MFA prompt was satisfied from 203.0.113.99 (regulator network). Confirmed by the device-binding check.",
    time: "Yesterday",
    critical: true,
  },
  {
    id: "n3",
    category: "record",
    title: "Access report ready",
    body: "PHI Access Report for May 2026 has been generated and is available in Reports → Archive.",
    time: "May 21",
    href: "/auditor/reports",
    read: true,
  },
  {
    id: "n4",
    category: "system",
    title: "Audit ledger checksum verified",
    body: "Nightly chain-of-custody check passed for the 24h rolling window. No tamper indicators.",
    time: "May 21",
    read: true,
  },
];

export default function AuditorNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Audit alerts & deliveries"
        description="Audit-grant expirations, security signals from your account, and report deliveries — all in one feed."
      />
      <NotificationsList items={NOTIFICATIONS} />
    </>
  );
}
