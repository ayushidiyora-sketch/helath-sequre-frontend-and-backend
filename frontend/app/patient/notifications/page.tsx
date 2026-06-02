import { PageHeader } from "@/components/shared/page-header";
import { DynamicNotifications } from "@/components/shared/dynamic-notifications";

export default function PatientNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Your notifications"
        description="Pending consent requests from your clinicians, upcoming appointments, and newly issued prescriptions."
      />
      <DynamicNotifications />
    </>
  );
}
