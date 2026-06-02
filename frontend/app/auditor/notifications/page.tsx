import { PageHeader } from "@/components/shared/page-header";
import { DynamicNotifications } from "@/components/shared/dynamic-notifications";

export default function AuditorNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Audit feed"
        description="Read-only feed of recent consent decisions and appointment bookings across your tenant."
      />
      <DynamicNotifications />
    </>
  );
}
