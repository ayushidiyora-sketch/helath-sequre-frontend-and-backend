"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  ShieldCheck,
  Hash,
  Tags,
  X,
  Loader2,
  CheckCircle2,
  AlertOctagon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SecurityBadge } from "@/components/shared/security-badge";
import { usePatientStore, type DocumentCategory } from "@/lib/patient-store";
import { scanFile, type ScanResult } from "@/lib/document-scanner";

type UploadPhase = "queued" | "scanning" | "uploading" | "done" | "blocked" | "failed";
interface UploadItem {
  pct: number;
  phase: UploadPhase;
  error?: string;
}

const PHASE_LABEL: Record<UploadPhase, string> = {
  queued: "Queued",
  scanning: "Virus scanning…",
  uploading: "Uploading",
  done: "Uploaded · clean",
  blocked: "Blocked by scanner",
  failed: "Failed",
};

/** POST a document with real upload-progress events via XHR. */
function postDocumentWithProgress(
  payload: unknown,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; data: { ok?: boolean; error?: string } | null }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/patient/documents");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: { ok?: boolean; error?: string } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, data: null });
    xhr.send(JSON.stringify(payload));
  });
}

const MAX_MB = 25;

const CATEGORIES: DocumentCategory[] = [
  "Insurance",
  "ID Proof",
  "Lab Report",
  "Imaging",
  "Prescription",
  "Other",
];

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Guess a document category from a File's mime type and filename so the
 * uploader doesn't have to manually pick. The user can still override via the
 * Category dropdown. Without this, every upload landed as "Other" — which is
 * what caused the patient's Documents sidebar to show "Other · 4" with every
 * other tag at 0.
 */
function guessCategory(file: File): DocumentCategory {
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  // Image files (PNG/JPG/JPEG/GIF/SVG/WEBP/DICOM thumbnails) → Imaging unless
  // the filename clearly says otherwise.
  const isImage = mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|tiff?|bmp|dcm)$/.test(name);
  if (/insur/.test(name)) return "Insurance";
  if (/aadhaar|aadhar|passport|driving|licen[cs]e|pan[-_ ]?card/.test(name)) return "ID Proof";
  if (/(prescription|^rx[-_ ]|[-_ ]rx[-_ ]|amlodip|atorvas|metformin)/.test(name)) return "Prescription";
  if (/(lab|report|panel|blood|cbc|lipid|hba1c|hemoglobin|urine|biopsy)/.test(name)) return "Lab Report";
  if (/(ecg|ekg|x[-_]?ray|mri|ct[-_ ]?scan|ultrasound|usg|sonograph|echo|imaging)/.test(name)) return "Imaging";
  if (isImage) return "Imaging";
  return "Other";
}

export default function UploadPage() {
  const router = useRouter();
  const { addDocument } = usePatientStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  // Pre-upload scan result per file (aligned with `files` by index).
  // "scanning" while the async scan is in flight.
  const [scans, setScans] = useState<(ScanResult | "scanning")[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("Other");
  // True once the user manually picks a category — disables auto-detect so
  // their override sticks even when they add more files.
  const [categoryEdited, setCategoryEdited] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.error("File too large", { description: `${f.name} exceeds the ${MAX_MB} MB limit.` });
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length) {
      // Index where the new files will land, so each async scan result can be
      // written back to the right slot.
      const baseIndex = files.length;
      setFiles((prev) => [...prev, ...accepted]);
      setScans((prev) => [...prev, ...accepted.map(() => "scanning" as const)]);
      // Auto-pick a category from the FIRST file (only if the user hasn't
      // overridden the dropdown yet). Multi-file uploads in mixed categories
      // are unusual; if it happens the user can re-pick before submitting.
      if (!categoryEdited && accepted[0]) {
        const guess = guessCategory(accepted[0]);
        setCategory(guess);
        if (guess !== "Other") {
          toast.info(`Tagged as ${guess}`, {
            description: "Auto-detected from the filename — change the Category dropdown if needed.",
          });
        }
      }
      // Pre-scan every newly added file (magic-byte / EICAR / suspicious-PDF-tag
      // checks) the moment it's selected. Blocked files are flagged inline and
      // excluded from the upload, so the user can't queue an unsafe file and
      // doesn't have to click "Start upload" to discover the problem.
      accepted.forEach((f, j) => {
        scanFile(f)
          .then((result) => {
            setScans((prev) => {
              const next = [...prev];
              next[baseIndex + j] = result;
              return next;
            });
            if (result.status === "infected") {
              toast.error(`Blocked: ${f.name}`, {
                description: result.reason ?? "Virus scan flagged this file.",
              });
            }
          })
          .catch(() => {
            setScans((prev) => {
              const next = [...prev];
              next[baseIndex + j] = { status: "infected", reason: "Could not scan this file." };
              return next;
            });
          });
      });
    }
  }

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  const patchItem = (i: number, patch: Partial<UploadItem>) =>
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  async function startUpload() {
    if (files.length === 0) return;
    setUploading(true);
    // Initialise a per-file progress row so each file shows its own bar +
    // phase (queued → scanning → uploading → done/blocked/failed).
    setItems(files.map(() => ({ pct: 0, phase: "queued" as UploadPhase })));
    // Per-file: scan first (lib/document-scanner — magic-byte verify, EICAR
    // signature, suspicious-extension and PDF-tag checks); if clean, POST
    // to /api/patient/documents to persist the row in Postgres. Local store
    // is mirrored after a successful API write so the documents page (which
    // still reads from the store) shows the row immediately.
    let accepted = 0;
    let rejected = 0;
    let netFailed = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      patchItem(i, { phase: "scanning", pct: 0 });
      // Reuse the result from the on-select pre-scan when present; only
      // re-scan if this file somehow has no result yet.
      const pre = scans[i];
      const scan = pre && pre !== "scanning" ? pre : await scanFile(f);
      if (scan.status === "infected") {
        rejected++;
        patchItem(i, { phase: "blocked", error: scan.reason ?? "Virus scan flagged this file." });
        toast.error(`Blocked: ${f.name}`, {
          description: scan.reason ?? "Virus scan flagged this file.",
        });
        continue;
      }
      let dataUrl = "";
      try {
        dataUrl = await readAsDataUrl(f);
      } catch {
        // FileReader can fail on huge / unreadable files — skip the dataUrl
        // but still try to register metadata.
      }
      // If the user explicitly picked a category, apply it to every file.
      // Otherwise each file gets its own auto-detected category — uploading
      // an insurance card + a lab report at once tags them correctly.
      const perFileCategory = categoryEdited ? category : guessCategory(f);
      const displayName = files.length === 1 && title.trim() ? title.trim() : f.name;

      // POST to the DB-backed endpoint with real upload-progress events. This
      // is the network call that shows in DevTools → Network and creates the
      // Postgres row.
      patchItem(i, { phase: "uploading", pct: 0 });
      const res = await postDocumentWithProgress(
        {
          name: displayName,
          category: perFileCategory,
          mimeType: f.type || null,
          sizeBytes: f.size,
          dataUrl,
          scanStatus: "clean",
        },
        (pct) => patchItem(i, { pct }),
      );
      if (!res.ok || !res.data?.ok) {
        netFailed++;
        patchItem(i, { phase: "failed", error: res.data?.error ?? `HTTP ${res.status}` });
        toast.error(`Could not save: ${f.name}`, {
          description: res.data?.error ?? `HTTP ${res.status}`,
        });
        continue;
      }

      // Mirror into local store so the existing /patient/documents page
      // (currently store-backed) shows the row immediately without waiting
      // for a refetch. The DB row is the canonical source.
      addDocument({
        name: displayName,
        category: perFileCategory,
        sizeBytes: f.size,
        uploadedBy: "patient",
        uploaderName: undefined,
        dataUrl,
        mimeType: f.type || undefined,
        scanStatus: "clean",
      });
      patchItem(i, { phase: "done", pct: 100 });
      accepted++;
    }
    setUploading(false);
    if (accepted > 0) {
      // Briefly let the completed bars render before navigating away.
      await new Promise((r) => setTimeout(r, 700));
      const tail: string[] = [];
      if (rejected > 0) tail.push(`${rejected} blocked`);
      if (netFailed > 0) tail.push(`${netFailed} failed to save`);
      tail.push(`${accepted} clean`);
      tail.push("audit-logged");
      toast.success(`${accepted} file${accepted > 1 ? "s" : ""} uploaded`, { description: tail.join(" · ") });
      router.push("/patient/documents");
    } else if (rejected + netFailed > 0) {
      // Every file was rejected or failed — stay on the page so the user can retry.
      setFiles([]);
      setScans([]);
      setItems([]);
    }
  }

  // Upload eligibility is driven by the on-select scan, not the click:
  //  - `scanning`  → a file is still being inspected (block the button)
  //  - cleanCount  → how many files are safe to send (the button's "(N)")
  //  - blockedCount→ flagged files, excluded from the upload entirely
  const scanning = scans.some((s) => s === "scanning");
  const cleanCount = scans.filter(
    (s): s is ScanResult => s !== undefined && s !== "scanning" && s.status === "clean",
  ).length;
  const blockedCount = scans.filter(
    (s): s is ScanResult => s !== undefined && s !== "scanning" && s.status === "infected",
  ).length;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/patient/documents" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Documents
        </Link>
        <span>/</span>
        <span>Upload</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Upload a document</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Files are virus-scanned before they touch storage. Encrypted at rest with AES-256.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
              dragging
                ? "border-[var(--color-primary)] bg-[var(--color-primary-50)]/50"
                : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)]/30"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.dcm"
              onChange={(e) => addFiles(e.target.files)}
            />
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
              <UploadCloud className="size-7" />
            </div>
            <p className="text-base font-semibold">Drop files to upload</p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              or click to browse · PDF, JPG, PNG, DOC, DICOM up to {MAX_MB} MB
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Select files
            </Button>
          </div>

          {/* Selected files */}
          {files.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <h2 className="text-sm font-semibold">
                Selected files <span className="text-[var(--color-muted-foreground)]">· {files.length}</span>
                {blockedCount > 0 && (
                  <span className="text-[var(--color-danger)]"> · {blockedCount} blocked</span>
                )}
              </h2>
              <ul className="mt-3 space-y-2">
                {files.map((f, i) => {
                  const it = items[i];
                  const sc = scans[i];
                  const showBar = it && (it.phase === "uploading" || it.phase === "done");
                  const blocked = !it && sc !== undefined && sc !== "scanning" && sc.status === "infected";
                  // Status text: during/after upload use the upload phase;
                  // before upload use the on-select scan result.
                  const statusLabel = it
                    ? PHASE_LABEL[it.phase]
                    : sc === "scanning"
                      ? "Scanning…"
                      : sc?.status === "infected"
                        ? "Blocked by scanner"
                        : sc?.status === "clean"
                          ? "Ready · clean"
                          : "";
                  const errorText =
                    it?.error ?? (blocked ? sc.reason : undefined);
                  return (
                    <li
                      key={`${f.name}-${i}`}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                        blocked
                          ? "border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]/30"
                          : "border-[var(--color-border)] bg-[var(--color-muted)]/30"
                      }`}
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                          blocked
                            ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                            : "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                        }`}
                      >
                        {blocked ? <AlertOctagon className="size-4" /> : <FileText className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-muted-foreground)]">
                          <span className={blocked ? "text-[var(--color-danger)]" : undefined}>
                            {fileSize(f.size)}
                            {statusLabel ? ` · ${statusLabel}` : ""}
                          </span>
                          {it?.phase === "uploading" && <span className="tabular-nums">{it.pct}%</span>}
                        </div>
                        {showBar && <Progress value={it.pct} className="mt-1.5" />}
                        {errorText && (
                          <p className="mt-1 text-[11px] text-[var(--color-danger)]">{errorText}</p>
                        )}
                      </div>
                      {uploading ? (
                        <PhaseIcon phase={it?.phase ?? "queued"} />
                      ) : (
                        <button
                          type="button"
                          aria-label="Remove file"
                          onClick={() => {
                            setFiles((prev) => prev.filter((_, idx) => idx !== i));
                            setScans((prev) => prev.filter((_, idx) => idx !== i));
                            setItems((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                          className="rounded p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold">Document details</h2>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Categorization helps your clinic find the right document quickly.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="title">Title {files.length > 1 && <span className="text-[10px] font-normal text-[var(--color-muted-foreground)]">· ignored for batch uploads</span>}</Label>
                <Input
                  id="title"
                  placeholder="e.g., Insurance card front"
                  leadingIcon={<FileText />}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={files.length > 1}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat">Category</Label>
                <select
                  id="cat"
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as DocumentCategory);
                    setCategoryEdited(true);
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tag">Tags</Label>
                <Input id="tag" placeholder="Comma-separated" leadingIcon={<Tags />} />
              </div>
            </div>
          </div>
        </div>

        {/* Side: policy */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Upload policy</p>
            <ul className="mt-3 space-y-2.5 text-[var(--color-muted-foreground)]">
              <li className="flex gap-2"><ShieldCheck className="size-3.5 shrink-0 text-[var(--color-success)]" /> Pre-storage virus scan via ClamAV</li>
              <li className="flex gap-2"><ShieldCheck className="size-3.5 shrink-0 text-[var(--color-success)]" /> AES-256 at rest in private S3 bucket</li>
              <li className="flex gap-2"><ShieldCheck className="size-3.5 shrink-0 text-[var(--color-success)]" /> Signed download URLs expire in 5 min</li>
              <li className="flex gap-2"><ShieldCheck className="size-3.5 shrink-0 text-[var(--color-success)]" /> Re-uploads create a versioned copy</li>
              <li className="flex gap-2"><Hash className="size-3.5 shrink-0 text-[var(--color-info)]" /> SHA-256 checksum stored with metadata</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <SecurityBadge variant="encrypted" />
              <SecurityBadge variant="audited" />
              <SecurityBadge variant="phi" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1" disabled={uploading}>
              <Link href="/patient/documents">Cancel</Link>
            </Button>
            <Button
              className="flex-1"
              onClick={startUpload}
              disabled={files.length === 0 || uploading || scanning || cleanCount === 0}
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" /> Uploading…
                </>
              ) : scanning ? (
                <>
                  <Loader2 className="animate-spin" /> Scanning…
                </>
              ) : (
                `Start upload${cleanCount > 0 ? ` (${cleanCount})` : ""}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function PhaseIcon({ phase }: { phase: UploadPhase }) {
  if (phase === "done") return <CheckCircle2 className="size-4 shrink-0 text-[var(--color-success)]" />;
  if (phase === "blocked" || phase === "failed")
    return <AlertOctagon className="size-4 shrink-0 text-[var(--color-danger)]" />;
  if (phase === "scanning" || phase === "uploading")
    return <Loader2 className="size-4 shrink-0 animate-spin text-[var(--color-muted-foreground)]" />;
  return <Loader2 className="size-4 shrink-0 text-[var(--color-muted-foreground)] opacity-40" />;
}
