import { PageHeader } from "@/components/shared/page-header";
import { DynamicNotifications } from "@/components/shared/dynamic-notifications";

export default function ComplianceNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Compliance feed"
        description="Pending sensitive-access requests, recent consent decisions, and audit checkpoints from your tenant."
      />
      <DynamicNotifications />
    </>
  );
}
