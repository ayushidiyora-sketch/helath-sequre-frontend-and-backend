import { PageHeader } from "@/components/shared/page-header";
import { EmergencyManager } from "./emergency-manager";

export default function PatientEmergencyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Safety"
        title="Emergency information"
        description="Surfaced to ER staff and on-call clinicians. Keep your blood group, critical contacts, allergies, and active medications up to date."
      />
      <EmergencyManager />
    </>
  );
}
