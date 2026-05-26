import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Beaker,
  Pill,
  FileImage,
  FileText,
  ClipboardList,
  Stethoscope,
  Calendar,
  Building2,
  Hash,
  Eye,
  CheckCircle2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SecurityBadge } from "@/components/shared/security-badge";
import { RecordActions } from "./record-actions";
import { RECORDS, getRecord, type Category } from "../records-data";

const CATEGORY_META: Record<Category, { icon: LucideIcon; accent: string }> = {
  "Lab Report": { icon: Beaker, accent: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]" },
  Prescription: { icon: Pill, accent: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]" },
  Imaging: { icon: FileImage, accent: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]" },
  "Clinical Note": { icon: FileText, accent: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]" },
  Discharge: { icon: ClipboardList, accent: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]" },
};

export function generateStaticParams() {
  return RECORDS.map((r) => ({ id: r.id }));
}

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = getRecord(id);
  if (!record) notFound();

  const meta = CATEGORY_META[record.category];
  const Icon = meta.icon;
  const finalized = record.status === "Finalized";

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/patient/records" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> All records
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{record.id}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        {/* Main content */}
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="border-b border-[var(--color-border)] p-6">
              <div className="flex items-start gap-4">
                <span className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.accent} text-white shadow-[var(--shadow-soft)]`}>
                  <Icon className="size-5" />
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">{record.title}</h1>
                    {finalized ? (
                      <Badge variant="success" size="sm" dot>Finalized · immutable</Badge>
                    ) : (
                      <Badge variant="info" size="sm" dot>Active</Badge>
                    )}
                    <Badge variant="muted" size="sm">{record.category}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                    {record.subtitle} · authored {record.date}
                  </p>
                </div>
                <RecordActions recordId={record.id} title={record.title} />
              </div>

              <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                <Field icon={Stethoscope} label="Clinician" value={record.clinician} />
                <Field icon={Building2} label="Facility" value={record.facility} />
                <Field icon={Calendar} label="Collection date" value={record.collectionDate} />
                <Field icon={Hash} label="Record ID" value={record.id} mono />
              </div>
            </div>

            {/* Body — varies by record type */}
            <div className="p-6">
              {record.results && (
                <>
                  <SectionTitle>Results</SectionTitle>
                  <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                          <th className="px-4 py-2.5">Marker</th>
                          <th className="px-4 py-2.5 text-right">Result</th>
                          <th className="px-4 py-2.5 text-right">Reference</th>
                          <th className="px-4 py-2.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {record.results.map((row) => (
                          <tr key={row.marker} className="hover:bg-[var(--color-muted)]/30">
                            <td className="px-4 py-3 font-medium">{row.marker}</td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums">{row.result}</td>
                            <td className="px-4 py-3 text-right text-[var(--color-muted-foreground)]">{row.reference}</td>
                            <td className="px-4 py-3 text-right">
                              {row.ok ? (
                                <Badge variant="success" size="sm" dot>Normal</Badge>
                              ) : (
                                <Badge variant="warning" size="sm" dot>Borderline</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {record.prescription && (
                <>
                  <SectionTitle>Prescription</SectionTitle>
                  <div className="rounded-xl border border-[var(--color-border)]">
                    <div className="grid gap-px bg-[var(--color-border)] sm:grid-cols-3">
                      <Cell label="Medication" value={record.prescription.drug} />
                      <Cell label="Strength" value={record.prescription.strength} />
                      <Cell label="Form" value={record.prescription.form} />
                      <Cell label="Frequency" value={record.prescription.frequency} />
                      <Cell label="Duration" value={record.prescription.duration} />
                      <Cell label="Refills" value={record.prescription.refills} />
                    </div>
                    <div className="border-t border-[var(--color-border)] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                        Instructions
                      </p>
                      <p className="mt-1 text-sm">{record.prescription.instructions}</p>
                    </div>
                  </div>
                </>
              )}

              {record.findings && (
                <>
                  <SectionTitle>Findings</SectionTitle>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4 text-sm leading-relaxed">
                    {record.findings}
                  </div>
                  {record.impression && (
                    <div className="mt-3 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-50)]/40 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
                        Impression
                      </p>
                      <p className="mt-1 text-sm font-medium">{record.impression}</p>
                    </div>
                  )}
                </>
              )}

              {record.noteBody && (
                <>
                  <SectionTitle>
                    {record.category === "Discharge" ? "Discharge summary" : "Note"}
                  </SectionTitle>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4 text-sm leading-relaxed">
                    {record.noteBody}
                  </div>
                </>
              )}

              {record.clinicianNote && (
                <>
                  <SectionTitle className="mt-7">Clinician notes</SectionTitle>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4 text-sm leading-relaxed">
                    <p>{record.clinicianNote}</p>
                    <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
                      — {record.clinician}
                      {finalized ? `, finalized ${record.date}` : ""}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h3 className="text-sm font-semibold">Security &amp; integrity</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <SecurityBadge variant="encrypted" />
              <SecurityBadge variant="audited" />
              <SecurityBadge variant="consent-bound" />
            </div>
            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted-foreground)]">Record version</dt>
                <dd className="font-mono">{finalized ? "v1 · final" : "v1 · active"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted-foreground)]">Checksum</dt>
                <dd className="font-mono">{checksum(record.id)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted-foreground)]">Encryption</dt>
                <dd>AES-256 (column-level)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted-foreground)]">Retention</dt>
                <dd>7 years (HIPAA default)</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
              <div>
                <h3 className="text-sm font-semibold">Access history</h3>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">Per-record audit trail · append-only</p>
              </div>
              <Badge variant="info" size="sm">5 events</Badge>
            </div>
            <ol className="space-y-0.5 p-5">
              {[
                { actor: record.clinician, action: finalized ? "record.finalize" : "record.create", icon: CheckCircle2, color: "text-[var(--color-success)] bg-[var(--color-success-soft)]", time: "12 days ago · 09:14", ip: "10.0.0.42" },
                { actor: record.clinician, action: "record.update", icon: Eye, color: "text-[var(--color-info)] bg-[var(--color-info-soft)]", time: "10 days ago · 14:02", ip: "10.0.0.42" },
                { actor: "Aarav Mehta (you)", action: "record.view", icon: Eye, color: "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]", time: "4 days ago · 21:33", ip: "203.0.113.42" },
                { actor: "Aarav Mehta (you)", action: "record.download", icon: Download, color: "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]", time: "4 days ago · 21:34", ip: "203.0.113.42" },
                { actor: "Auditor (regulator)", action: "record.view", icon: Eye, color: "text-[var(--color-muted-foreground)] bg-[var(--color-muted)]", time: "2 days ago · 11:08", ip: "203.0.113.99" },
              ].map((e, i) => {
                const EIcon = e.icon;
                return (
                  <li key={i} className="relative flex gap-3 py-2">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${e.color}`}>
                      <EIcon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs">
                        <span className="font-medium">{e.actor}</span>{" "}
                        <span className="text-[var(--color-muted-foreground)]">·</span>{" "}
                        <code className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{e.action}</code>
                      </p>
                      <p className="text-[10px] text-[var(--color-muted-foreground)]">
                        {e.time} <span className="mx-1">·</span>
                        <span className="font-mono">{e.ip}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="border-t border-[var(--color-border)] p-3">
              <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
                Showing 5 most-recent events. Every PHI access is logged in the append-only ledger.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/30 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]">
                <AlertCircle className="size-4" />
              </span>
              <div className="text-xs">
                <p className="font-medium text-[var(--color-foreground)]">
                  {finalized ? "Read-only record" : "Active record"}
                </p>
                <p className="mt-0.5 text-[var(--color-muted-foreground)]">
                  {finalized
                    ? "This record has been finalized by the authoring clinician. You can view, download, and share, but cannot edit the contents."
                    : "This record is currently active. It may be updated by your care team; you have read-only access."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] ${className}`}>
      {children}
    </h2>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
      <Icon className="size-4 text-[var(--color-muted-foreground)]" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">{label}</p>
        <p className={`truncate text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-card)] p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

/** Deterministic short checksum from the record id (display only). */
function checksum(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hex = h.toString(16).padStart(8, "0");
  return `${hex.slice(0, 4)} · ${hex.slice(4, 8)}`;
}
