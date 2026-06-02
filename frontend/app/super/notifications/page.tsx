import { PageHeader } from "@/components/shared/page-header";
import { DynamicNotifications } from "@/components/shared/dynamic-notifications";

export default function SuperNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Platform feed"
        description="Newly provisioned tenants and recent organization-admin onboardings across the platform."
      />
      <DynamicNotifications />
    </>
  );
}
