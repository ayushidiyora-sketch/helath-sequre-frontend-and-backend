import { PageHeader } from "@/components/shared/page-header";
import { FamilyManager } from "./family-manager";

export default function PatientFamilyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Family & dependents"
        description="Manage authorised caregivers and dependents. They appear here for clinical staff during emergencies and for shared-account workflows."
      />
      <FamilyManager />
    </>
  );
}
