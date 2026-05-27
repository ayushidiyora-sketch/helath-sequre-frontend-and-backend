import { redirect } from "next/navigation";

/**
 * Patient-scoped entry into the note authoring screen. The note editor lives
 * at /clinician/notes/new and accepts ?patient=<id>; this route exists so the
 * patient-chart breadcrumb can deep-link via a stable URL (Sec 8.3) without
 * duplicating the editor.
 */
export default async function PatientRecordsNewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/clinician/notes/new?patient=${encodeURIComponent(id)}`);
}
