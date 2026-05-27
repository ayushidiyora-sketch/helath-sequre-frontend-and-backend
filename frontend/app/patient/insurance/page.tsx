import { PageHeader } from "@/components/shared/page-header";
import { InsuranceManager } from "./insurance-manager";

export default function PatientInsurancePage() {
  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Insurance plans"
        description="Track every active insurance plan, mark your primary, and store cards for cashless visits. Demo only — real claims integration comes with the backend."
      />
      <InsuranceManager />
    </>
  );
}
