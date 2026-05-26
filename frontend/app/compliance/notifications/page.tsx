import { PageHeader } from "@/components/shared/page-header";
import {
  NotificationsList,
  type SimpleNotification,
} from "@/components/shared/notifications-list";

const NOTIFICATIONS: SimpleNotification[] = [
  {
    id: "n1",
    category: "security",
    title: "Anomaly · bulk document download",
    body: "Dr. K. Patel downloaded 32 documents in 4 minutes at 2:14 AM IST from a residential IP. Awaiting investigation.",
    time: "12m ago",
    href: "/compliance/anomalies/bulk-document-download",
    critical: true,
  },
  {
    id: "n2",
    category: "approval",
    title: "New sensitive-access request · Dr. R. Sharma",
    body: "Requesting 24h emergency access to MRN-67890 (unassigned PHI). Reason: Dr. Verma on leave, covering ER.",
    time: "1h ago",
    href: "/compliance/approvals/req-001",
  },
  {
    id: "n3",
    category: "consent",
    title: "Re-consent campaign · 94% adoption",
    body: "Policy v2.4 campaign reached 1,212 of 1,284 patients. 72 remaining (48 inactive, 14 bounced, 10 deactivated).",
    time: "3h ago",
    href: "/compliance/campaigns/camp-v2-4",
  },
  {
    id: "n4",
    category: "record",
    title: "GDPR deletion request · Tarun Mehta",
    body: "Patient requested account deletion via portal. Pending retention-aware review.",
    time: "Yesterday",
    href: "/compliance/deletion-requests/del-001",
  },
  {
    id: "n5",
    category: "audit",
    title: "Weekly compliance summary generated",
    body: "May 19–25 summary ready: 12,489 events, 4 anomalies (all resolved), 98% policy adherence.",
    time: "May 25",
    href: "/compliance/reports",
    read: true,
  },
  {
    id: "n6",
    category: "system",
    title: "Audit ledger checksum verified",
    body: "Nightly chain-of-custody verification passed for 24h rolling window.",
    time: "May 25",
    read: true,
  },
];

export default function ComplianceNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Compliance feed"
        description="Anomalies, sensitive-access requests, campaign progress, and audit checkpoints — what needs your attention this hour."
      />
      <NotificationsList items={NOTIFICATIONS} />
    </>
  );
}
