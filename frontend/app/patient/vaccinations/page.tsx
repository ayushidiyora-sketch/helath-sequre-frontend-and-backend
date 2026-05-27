import { PageHeader } from "@/components/shared/page-header";
import { VaccinationsManager } from "./vaccinations-manager";

export default function PatientVaccinationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Vaccinations"
        description="Your full vaccination history — including travel vaccines and upcoming dose reminders. Download certificates for school, employer, or international travel."
      />
      <VaccinationsManager />
    </>
  );
}
