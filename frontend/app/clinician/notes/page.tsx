"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileSignature, FileText, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useClinicianStore } from "@/lib/clinician-store";

function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function NotesIndexPage() {
  const { state } = useClinicianStore();
  const [draftQuery, setDraftQuery] = useState("");
  const [finalizedQuery, setFinalizedQuery] = useState("");

  const patientName = (id: string) => state.assignedPatients.find((p) => p.id === id)?.name ?? "Unknown patient";
  const patientMrn = (id: string) => state.assignedPatients.find((p) => p.id === id)?.mrn ?? "";

  const drafts = useMemo(() => state.notes.filter((n) => n.status === "draft").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [state.notes]);
  const finalized = useMemo(() => state.notes.filter((n) => n.status === "finalized").sort((a, b) => (b.finalizedAt ?? "").localeCompare(a.finalizedAt ?? "")), [state.notes]);

  const dq = draftQuery.trim().toLowerCase();
  const filteredDrafts = dq
    ? drafts.filter((d) => [d.template, patientName(d.patientId)].some((f) => f.toLowerCase().includes(dq)))
    : drafts;

  const fq = finalizedQuery.trim().toLowerCase();
  const filteredFinalized = fq
    ? finalized.filter((f) => [f.template, patientName(f.patientId), f.id].some((field) => field.toLowerCase().includes(fq)))
    : finalized;

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  return (
    <>
      <PageHeader
        eyebrow="Notes"
        title="Clinical notes"
        description="Draft, sign, and lock SOAP / progress / discharge notes. Drafts auto-save; finalized notes are immutable."
        actions={
          <Button asChild size="sm"><Link href="/clinician/notes/new"><Plus /> New note</Link></Button>
        }
      />

      <Tabs defaultValue="drafts">
        <TabsList>
          <TabsTrigger value="drafts">Drafts · {drafts.length}</TabsTrigger>
          <TabsTrigger value="finalized">Finalized · {finalized.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="drafts">
          <Input
            className="mb-4"
            placeholder="Search drafts…"
            leadingIcon={<Search />}
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
          />
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <ul className="divide-y divide-[var(--color-border)]">
              {filteredDrafts.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/clinician/notes/new?patient=${d.patientId}`}
                    className="flex items-center gap-4 p-5 hover:bg-[var(--color-muted)]/40"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]">
                      <FileText className="size-4.5" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{d.template} — {patientName(d.patientId)}</p>
                      <p className="text-[11px] text-[var(--color-muted-foreground)]">
                        {patientName(d.patientId)} · {patientMrn(d.patientId)} · updated {dateTimeLabel(d.updatedAt)}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-[var(--color-primary-700)]">Continue editing →</span>
                  </Link>
                </li>
              ))}
              {filteredDrafts.length === 0 && (
                <li className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">
                  {drafts.length === 0 ? "No drafts yet. Start a new note." : `No drafts match “${draftQuery}”.`}
                </li>
              )}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="finalized">
          <Input
            className="mb-4"
            placeholder="Search finalized notes…"
            leadingIcon={<Search />}
            value={finalizedQuery}
            onChange={(e) => setFinalizedQuery(e.target.value)}
          />
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <ul className="divide-y divide-[var(--color-border)]">
              {filteredFinalized.map((f) => (
                <li key={f.id} className="flex items-center gap-4 p-5 hover:bg-[var(--color-muted)]/40">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-success-soft)] text-[var(--color-success)]">
                    <FileSignature className="size-4.5" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{f.template} — {patientName(f.patientId)}</p>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">
                      {patientName(f.patientId)} · finalized {f.finalizedAt ? dateTimeLabel(f.finalizedAt) : "—"} · <span className="font-mono">{f.id}</span>
                    </p>
                  </div>
                  <Badge variant="success" size="sm" dot>Locked</Badge>
                </li>
              ))}
              {filteredFinalized.length === 0 && (
                <li className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">
                  {finalized.length === 0 ? "No finalized notes yet." : `No finalized notes match “${finalizedQuery}”.`}
                </li>
              )}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
