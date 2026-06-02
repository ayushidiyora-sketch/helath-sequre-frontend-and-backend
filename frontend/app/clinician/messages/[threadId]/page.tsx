import { Suspense } from "react";
import { ClinicianMessagesView } from "../clinician-messages-view";

/**
 * Deep-link entry — opens the side-by-side messages view. The legacy threadId
 * route param is currently ignored: the new DB-backed view auto-selects the
 * most-recent thread on mount, and external links can use
 * `/clinician/messages?thread=<otherUserId>` to target a specific conversation.
 */
export default function ClinicianThreadPage() {
  return (
    <Suspense fallback={null}>
      <ClinicianMessagesView />
    </Suspense>
  );
}
