import { Suspense, use } from "react";
import { MessagesView } from "../messages-view";

/** Deep-link entry — picks the thread named by the URL param and renders the
 *  same inbox view, so users can bookmark a conversation. */
export default function MessageThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  return (
    <Suspense fallback={null}>
      <MessagesView initialThreadId={threadId} />
    </Suspense>
  );
}
