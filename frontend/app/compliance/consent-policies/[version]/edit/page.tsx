"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PolicyForm, type FormPolicy } from "../../policy-form";

export default function EditPolicyVersionPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = use(params);
  const [policy, setPolicy] = useState<FormPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/compliance/consent-policies/${encodeURIComponent(version)}`, { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (res.status === 404 || !json?.ok) { setMissing(true); return; }
        const raw = json.policy as {
          id: string; version: string; slug: string; status: string;
          summary: string; sections: { heading: string; body: string }[];
          scopeCategories: number; roleBindings: number; effectiveDate: string | null;
        };
        setPolicy({
          id: raw.id,
          version: raw.version,
          slug: raw.slug,
          status: raw.status as FormPolicy["status"],
          summary: raw.summary,
          sections: Array.isArray(raw.sections) ? raw.sections : [],
          scopeCategories: raw.scopeCategories,
          roleBindings: raw.roleBindings,
          effectiveDate: raw.effectiveDate,
        });
      } catch (err) { console.error("[policy edit] fetch", err); setMissing(true); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [version]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading policy…
      </div>
    );
  }
  if (missing || !policy) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Link href="/compliance/consent-policies" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
            <ArrowLeft className="size-3.5" /> Consent policies
          </Link>
        </div>
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
          Policy not found in this tenant.
        </div>
      </div>
    );
  }

  return <PolicyForm policy={policy} />;
}
