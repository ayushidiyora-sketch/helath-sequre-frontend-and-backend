"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Beaker,
  Pill,
  FileImage,
  FileText,
  FileDown,
  ClipboardList,
  Stethoscope,
  Calendar,
  Building2,
  Hash,
  Eye,
  CheckCircle2,
  UploadCloud,
  Share2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SecurityBadge } from "@/components/shared/security-badge";
import { LabResultsViewer } from "@/components/shared/lab-results-viewer";
import { ImagingViewer } from "@/components/shared/imaging-viewer";
import { RecordActions } from "./record-actions";
import { getRecord, type AccessEvent, type Category, type RecordDetail } from "../records-data";

const CATEGORY_META: Record<Category, { icon: LucideIcon; accent: string }> = {
  "Lab Report": { icon: Beaker, accent: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]" },
  Prescription: { icon: Pill, accent: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]" },
  Imaging: { icon: FileImage, accent: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]" },
  "Clinical Note": { icon: FileText, accent: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]" },
  Discharge: { icon: ClipboardList, accent: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]" },
  Insurance: { icon: FileText, accent: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]" },
  "ID Proof": { icon: FileImage, accent: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]" },
  Other: { icon: FileText, accent: "from-[oklch(0.6_0.04_250)] to-[oklch(0.45_0.04_250)]" },
};

export default function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  // undefined = loading, null = not found, else the record.
  const [record, setRecord] = useState<RecordDetail | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    // Demo lab/imaging viewer records live in the static array; everything else
    // (prescriptions, clinical notes, discharge, shared documents) comes from
    // the DB via the patient records API.
    const demo = getRecord(id);
    if (demo) {
      setRecord(demo);
      return;
    }
    (async () => {
      try {
        // Single-record endpoint returns full content (incl. the uploaded file
        // for documents) + the real access trail, and logs a record.view event.
        const r = await fetch(`/api/patient/records/${id}`, { cache: "no-store" });
        const data = await r.json();
        if (cancelled) return;
        if (r.ok && data?.ok && data.record) {
          setRecord(data.record as RecordDetail);
        } else {
          setRecord(null);
        }
      } catch {
        if (!cancelled) setRecord(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (record === undefined) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading record…
      </div>
    );
  }
  if (record === null) {
    return <RecordNotFound id={id} />;
  }

  const meta = CATEGORY_META[record.category] ?? CATEGORY_META.Other;
  const Icon = meta.icon;
  const finalized = record.status === "Finalized";
  const collectionDate = record.collectionDate ?? record.date;

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
                <RecordActions record={record} />
              </div>

              <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                <Field icon={Stethoscope} label="Clinician" value={record.clinician} />
                <Field icon={Building2} label="Facility" value={record.facility} />
                <Field icon={Calendar} label="Collection date" value={collectionDate} />
                <Field icon={Hash} label="Record ID" value={record.id} mono />
              </div>
            </div>

            {/* Body — varies by record type */}
            <div className="p-6">
              {record.results && (
                <>
                  <SectionTitle>Results</SectionTitle>
                  <LabResultsViewer results={record.results} />
                </>
              )}

              {record.images && record.images.length > 0 && (
                <>
                  <SectionTitle>Images</SectionTitle>
                  <ImagingViewer
                    images={record.images}
                    modality={record.modality}
                    bodyPart={record.bodyPart}
                    studyDate={collectionDate}
                  />
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
                  <SectionTitle className={record.images ? "mt-7" : ""}>Findings</SectionTitle>
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

              {/* Uploaded clinical document — inline preview of the original file. */}
              {record.fileUrl && (
                <>
                  <SectionTitle>Document preview</SectionTitle>
                  <DocumentPreview
                    fileUrl={record.fileUrl}
                    mimeType={record.mimeType ?? null}
                    title={record.title}
                    sizeBytes={record.sizeBytes}
                  />
                </>
              )}

              {/* Records with no renderable body (e.g. a shared doc with no file). */}
              {!record.results && !record.images && !record.prescription &&
                !record.findings && !record.noteBody && !record.clinicianNote &&
                !record.fileUrl && (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/20 p-6 text-center text-sm text-[var(--color-muted-foreground)]">
                  No previewable content for this record. Use Download to export a summary.
                </div>
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

          <AccessHistory events={record.accessLog ?? []} />

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

function RecordNotFound({ id }: { id: string }) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/patient/records" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> All records
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{id}</span>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
          <FileText className="size-5" />
        </div>
        <p className="text-sm font-medium">Record not found</p>
        <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
          This record doesn&apos;t exist or you don&apos;t have access to it. Access attempts are audit-logged.
        </p>
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

// ---------------------------------------------------------------------------
// Document preview — renders the uploaded file inline (image / PDF / fallback).
// ---------------------------------------------------------------------------

function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Decode a `data:` URL into its MIME + raw bytes (null if not a data URL). */
function decodeDataUrl(url: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(url);
  if (!m) return null;
  const mime = m[1] || "";
  try {
    if (m[2]) {
      const bin = atob(m[3]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { mime, bytes };
    }
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(m[3])) };
  } catch {
    return null;
  }
}

/** True when the bytes begin with the `%PDF` magic header. */
function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function DocumentPreview({
  fileUrl,
  mimeType,
  title,
  sizeBytes,
}: {
  fileUrl: string;
  mimeType: string | null;
  title: string;
  sizeBytes?: number;
}) {
  const decoded = fileUrl.startsWith("data:") ? decodeDataUrl(fileUrl) : null;
  const mime = (mimeType || decoded?.mime || "").toLowerCase();
  const isImage = mime.startsWith("image/");
  const claimsPdf = mime === "application/pdf" || /\.pdf$/i.test(title);
  // A file can be mislabeled (e.g. placeholder text saved as application/pdf).
  // Only treat it as a real PDF when the bytes actually start with %PDF.
  const isRealPdf = claimsPdf && (decoded ? looksLikePdf(decoded.bytes) : true);
  const corruptPdf = claimsPdf && decoded != null && !looksLikePdf(decoded.bytes);

  // Render PDFs from a Blob/object URL — more reliable than a large data: URL.
  const [objUrl, setObjUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isRealPdf || !decoded) return;
    const blob = new Blob([decoded.bytes], { type: "application/pdf" });
    const u = URL.createObjectURL(blob);
    setObjUrl(u);
    return () => URL.revokeObjectURL(u);
    // fileUrl is the stable identity of the file here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, isRealPdf]);

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fileUrl}
        alt={title}
        className="max-h-[520px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 object-contain"
      />
    );
  }
  if (isRealPdf) {
    return (
      <object
        data={objUrl ?? fileUrl}
        type="application/pdf"
        className="h-[600px] w-full rounded-xl border border-[var(--color-border)] bg-white"
      >
        <DownloadTile fileUrl={fileUrl} title={title} mime={mime} sizeBytes={sizeBytes} note="Your browser can't display PDFs inline." />
      </object>
    );
  }
  return (
    <DownloadTile
      fileUrl={fileUrl}
      title={title}
      mime={mime}
      sizeBytes={sizeBytes}
      note={corruptPdf ? "This file is marked as PDF but isn't a valid PDF, so it can't be previewed." : undefined}
    />
  );
}

function DownloadTile({
  fileUrl,
  title,
  mime,
  sizeBytes,
  note,
}: {
  fileUrl: string;
  title: string;
  mime: string;
  sizeBytes?: number;
  note?: string;
}) {
  return (
    <div className="space-y-2">
      {note && (
        <p className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/30 px-3 py-2 text-xs text-[var(--color-foreground)]/85">
          {note}
        </p>
      )}
      <a
        href={fileUrl}
        download={title}
        className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-5 transition-colors hover:border-[var(--color-primary)]/40"
      >
        <span className="flex size-11 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
          <FileDown className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {mime || "File"}{sizeBytes ? ` · ${fmtSize(sizeBytes)}` : ""} · click to download
          </p>
        </div>
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Access history — real per-record audit trail from the DB.
// ---------------------------------------------------------------------------

const ACTION_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  "record.create": { label: "Created", icon: CheckCircle2, color: "text-[var(--color-success)] bg-[var(--color-success-soft)]" },
  "record.finalize": { label: "Finalized", icon: CheckCircle2, color: "text-[var(--color-success)] bg-[var(--color-success-soft)]" },
  "record.upload": { label: "Uploaded", icon: UploadCloud, color: "text-[var(--color-success)] bg-[var(--color-success-soft)]" },
  "record.view": { label: "Viewed", icon: Eye, color: "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]" },
  "record.download": { label: "Downloaded", icon: Download, color: "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]" },
  "record.share": { label: "Shared", icon: Share2, color: "text-[var(--color-info)] bg-[var(--color-info-soft)]" },
};

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (mins < 1) return `just now · ${time}`;
  if (mins < 60) return `${mins}m ago · ${time}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago · ${time}`;
  const days = Math.round(hrs / 24);
  return `${days}d ago · ${time}`;
}

function AccessHistory({ events }: { events: AccessEvent[] }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h3 className="text-sm font-semibold">Access history</h3>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">Per-record audit trail · append-only</p>
        </div>
        <Badge variant="info" size="sm">{events.length} event{events.length === 1 ? "" : "s"}</Badge>
      </div>
      {events.length === 0 ? (
        <p className="p-5 text-center text-xs text-[var(--color-muted-foreground)]">No access events recorded yet.</p>
      ) : (
        <ol className="space-y-0.5 p-5">
          {events.map((e, i) => {
            const meta = ACTION_META[e.action] ?? { label: e.action, icon: Eye, color: "text-[var(--color-muted-foreground)] bg-[var(--color-muted)]" };
            const EIcon = meta.icon;
            return (
              <li key={i} className="relative flex gap-3 py-2">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                  <EIcon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-medium">{e.actor}</span>{" "}
                    <span className="text-[var(--color-muted-foreground)]">·</span>{" "}
                    <code className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{e.action}</code>
                  </p>
                  <p className="text-[10px] text-[var(--color-muted-foreground)]">
                    {relTime(e.at)}
                    {e.ip ? (<>{" "}<span className="mx-1">·</span><span className="font-mono">{e.ip}</span></>) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="border-t border-[var(--color-border)] p-3">
        <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
          Every PHI access is logged in the append-only ledger.
        </p>
      </div>
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
