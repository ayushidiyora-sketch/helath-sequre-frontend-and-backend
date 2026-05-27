import { Suspense } from "react";
import { ClinicianMessagesView } from "./clinician-messages-view";

export default function ClinicianMessagesPage() {
  return (
    <Suspense fallback={null}>
      <ClinicianMessagesView />
    </Suspense>
  );
}
