import { notFound } from "next/navigation";
import { PATIENTS, getPatient } from "../../patients-data";
import { EditPatientForm } from "./edit-patient-form";

export function generateStaticParams() {
  return PATIENTS.map((p) => ({ id: p.id }));
}

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = getPatient(id);
  if (!patient) notFound();
  return <EditPatientForm patient={patient} />;
}
