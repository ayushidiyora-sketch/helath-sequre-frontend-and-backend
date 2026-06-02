import { PageHeader } from "@/components/shared/page-header";
import { DynamicNotifications } from "@/components/shared/dynamic-notifications";

export default function ClinicianNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Care-team feed"
        description="Patient decisions on your consent requests, new bookings on your schedule, and freshly assigned patients."
      />
      <DynamicNotifications />
    </>
  );
}
