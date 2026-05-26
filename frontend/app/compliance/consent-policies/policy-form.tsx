"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ScrollText, FileText, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { PolicyVersion } from "./consent-policies-data";

const SECTION_HEADINGS = [
  "Purpose & scope",
  "PHI categories covered",
  "Retention & data portability",
  "Re-consent & revocation",
];

/** Shared editor for drafting a new policy version or editing an existing draft. */
export function PolicyForm({ policy }: { policy?: PolicyVersion }) {
  const router = useRouter();
  const isEdit = Boolean(policy);
  const version = policy?.version ?? "v2.5";

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/compliance/consent-policies"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Consent policies
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">
          {isEdit ? `Edit ${version} draft` : "Create New Policy"}
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {isEdit ? `Edit policy ${version}` : "Draft a new policy version"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {isEdit
            ? "Update the legal text and scope. Changes are audit-logged."
            : "Draft the legal text for the next version. Activating it later triggers a re-consent campaign."}
        </p>
      </div>

      <form
        className="max-w-5xl"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success(
            isEdit ? `Policy ${version} draft saved` : `Policy version ${version} drafted`,
            { description: isEdit ? "Changes saved · audit-logged" : "Edit legal text, then activate · audit-logged" },
          );
          router.push("/compliance/consent-policies");
        }}
      >
        <div className="grid gap-5 lg:grid-cols-[1.85fr_1fr]">
          <div className="space-y-5">
            {/* Meta */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4" /> Version details
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="version">Version label</Label>
                  <Input id="version" defaultValue={version} className="font-mono" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="effective_date">Effective date</Label>
                  <Input id="effective_date" type="date" required />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="summary">Summary</Label>
                  <Input
                    id="summary"
                    defaultValue={policy?.summary}
                    placeholder="One line describing what changed in this version"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scope_categories">Granular scope categories</Label>
                  <Input
                    id="scope_categories"
                    type="number"
                    min={1}
                    defaultValue={policy?.scopeCategories ?? 7}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role_bindings">Role bindings</Label>
                  <Input
                    id="role_bindings"
                    type="number"
                    min={1}
                    defaultValue={policy?.roleBindings ?? 3}
                  />
                </div>
              </div>
            </div>

            {/* Legal text */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <ScrollText className="size-4" /> Policy legal text
              </h2>
              <div className="mt-4 space-y-4">
                {SECTION_HEADINGS.map((heading, i) => (
                  <div key={heading} className="space-y-1.5">
                    <Label htmlFor={`section_${i}`}>
                      {i + 1}. {heading}
                    </Label>
                    <Textarea
                      id={`section_${i}`}
                      rows={4}
                      defaultValue={policy?.sections[i]?.body}
                      placeholder={`Legal text for "${heading}"…`}
                      required
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                {isEdit ? "Editing draft" : "New draft"}
              </p>
              <p className="mt-1 font-mono text-sm font-semibold">{version}</p>
              <Button type="submit" className="mt-4 w-full">
                <Save /> {isEdit ? "Save draft" : "Create draft"}
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link href="/compliance/consent-policies">Cancel</Link>
              </Button>
              <span className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                <ShieldCheck className="size-3.5" /> Policy changes are audit-logged
              </span>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs text-[var(--color-muted-foreground)]">
              A draft is not live. Activating it later triggers a re-consent
              campaign for patients still bound to an older version.
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}
