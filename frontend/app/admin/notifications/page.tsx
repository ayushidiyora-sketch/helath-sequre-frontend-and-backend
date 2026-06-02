import { PageHeader } from "@/components/shared/page-header";
import { DynamicNotifications } from "@/components/shared/dynamic-notifications";

export default function AdminNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Org-level notifications"
        description="New staff joinings, patient signups, and care-team assignments in your organization."
      />
      <DynamicNotifications />
    </>
  );
}
