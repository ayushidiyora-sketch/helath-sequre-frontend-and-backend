import { Suspense } from "react";
import { MessagesView } from "../messages-view";

/**
 * Deep-link entry — opens the inbox. The legacy `threadId` route param is
 * currently ignored; the DB-backed view auto-selects the most-recent thread,
 * and `/patient/messages?thread=<otherUserId>` can target a specific
 * conversation when needed.
 */
export default function MessageThreadPage() {
  return (
    <Suspense fallback={null}>
      <MessagesView />
    </Suspense>
  );
}
