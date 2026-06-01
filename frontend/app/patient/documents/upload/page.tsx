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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SecurityBadge } from "@/components/shared/security-badge";
import { usePatientStore, type DocumentCategory } from "@/lib/patient-store";

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
      setFiles((prev) => [...prev, ...accepted]);
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

  async function startUpload() {
    if (files.length === 0) return;
    setUploading(true);
    // Persist each file into the patient store INCLUDING its bytes (base64
    // data URL) and mime type so the documents page can render a real preview
    // in a new tab and download the real file. The store auto-flips
    // scanStatus from pending_scan → clean after ~1.5s to simulate ClamAV.
    for (const f of files) {
      let dataUrl = "";
      try {
        dataUrl = await readAsDataUrl(f);
      } catch {
        // If FileReader fails for some reason we still persist the metadata —
        // the row will show but the preview/download will be a placeholder.
      }
      // If the user explicitly picked a category, apply it to every file.
      // Otherwise each file gets its own auto-detected category — uploading
      // an insurance card + a lab report at once tags them correctly.
      const perFileCategory = categoryEdited ? category : guessCategory(f);
      addDocument({
        name: files.length === 1 && title.trim() ? title.trim() : f.name,
        category: perFileCategory,
        sizeBytes: f.size,
        uploadedBy: "patient",
        uploaderName: undefined,
        dataUrl,
        mimeType: f.type || undefined,
      });
    }
    setTimeout(() => {
      toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`, {
        description: "Virus scan queued · encrypted at rest · audit-logged",
      });
      router.push("/patient/documents");
    }, 600);
  }

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
              </h2>
              <ul className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-3 py-2"
                  >
                    <span className="flex size-8 items-center justify-center rounded-md bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="text-[11px] text-[var(--color-muted-foreground)]">{fileSize(f.size)}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="rounded p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
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
            <Button asChild variant="outline" className="flex-1">
              <Link href="/patient/documents">Cancel</Link>
            </Button>
            <Button className="flex-1" onClick={startUpload} disabled={files.length === 0 || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" /> Uploading…
                </>
              ) : (
                `Start upload${files.length > 0 ? ` (${files.length})` : ""}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
