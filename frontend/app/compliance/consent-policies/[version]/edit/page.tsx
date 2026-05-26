import { notFound } from "next/navigation";
import { POLICIES, getPolicy } from "../../consent-policies-data";
import { PolicyForm } from "../../policy-form";

export function generateStaticParams() {
  return POLICIES.map((p) => ({ version: p.slug }));
}

export default async function EditPolicyVersionPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const policy = getPolicy(version);
  if (!policy) notFound();
  return <PolicyForm policy={policy} />;
}
