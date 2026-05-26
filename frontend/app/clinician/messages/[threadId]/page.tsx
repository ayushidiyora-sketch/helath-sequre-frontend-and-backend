import { use } from "react";
import { ClinicianMessagesView } from "../clinician-messages-view";
import { THREADS } from "../clinician-messages-data";

export function generateStaticParams() {
  return THREADS.map((t) => ({ threadId: t.id }));
}

/** Deep-link entry — opens the side-by-side messages view with this thread active. */
export default function ClinicianThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = use(params);
  return <ClinicianMessagesView initialThreadId={threadId} />;
}
