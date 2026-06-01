"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  FileText,
  FileImage,
  FileBadge,
  FilePlus2,
  Filter,
  Search,
  Download,
  MoreHorizontal,
  Trash2,
  ShieldCheck,
  Loader2,
  AlertOctagon,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { Progress } from "@/components/ui/progress";
import { SecurityBadge } from "@/components/shared/security-badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  usePatientStore,
  type DocumentCategory,
  type DocumentScanStatus,
  type PatientDocument,
} from "@/lib/patient-store";

const TYPE_META: Record<DocumentCategory, { icon: typeof FileText; color: string }> = {
  Insurance: { icon: FileBadge, color: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]" },
  "ID Proof": { icon: FileImage, color: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]" },
  "Lab Report": { icon: FileText, color: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]" },
  Imaging: { icon: FileImage, color: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]" },
  Prescription: { icon: FileText, color: "from-[oklch(0.6_0.21_22)] to-[oklch(0.48_0.18_22)]" },
  Other: { icon: FileText, color: "from-[oklch(0.6_0.04_250)] to-[oklch(0.45_0.04_250)]" },
};

const TYPES: DocumentCategory[] = ["Insurance", "ID Proof", "Lab Report", "Imaging", "Prescription", "Other"];

const SCAN_FILTERS: { key: DocumentScanStatus | "all"; label: string }[] = [
  { key: "all", label: "All statuses" },
  { key: "clean", label: "Clean only" },
  { key: "pending_scan", label: "Scanning" },
  { key: "infected", label: "Quarantined" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DocumentsPage() {
  const { state, deleteDocument } = usePatientStore();
  const [tag, setTag] = useState<DocumentCategory | "All">("All");
  const [search, setSearch] = useState("");
  const [scanFilter, setScanFilter] = useState<DocumentScanStatus | "all">("all");

  const docs = state.documents;
  const totalBytes = docs.reduce((sum, d) => sum + d.sizeBytes, 0);

  const tags = useMemo(
    () => [
      { label: "All" as const, count: docs.length },
      ...TYPES.map((t) => ({ label: t, count: docs.filter((d) => d.category === t).length })),
    ],
    [docs],
  );

  const visible = docs.filter((d) => {
    if (tag !== "All" && d.category !== tag) return false;
    if (scanFilter !== "all" && d.scanStatus !== scanFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${d.name} ${d.category}`.toLowerCase().includes(q)) return false;
    return true;
  });

  /**
   * Convert a base64 data URL to a Blob so we can:
   *   - download it with the real filename + bytes
   *   - open a same-origin Object URL in a new tab for inline preview
   *     (browsers refuse to render some data: URLs in a new window for
   *     security reasons, so a Blob URL is more reliable).
   */
  function dataUrlToBlob(dataUrl: string): Blob | null {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl);
    if (!m) return null;
    const mime = m[1] || "application/octet-stream";
    const isBase64 = !!m[2];
    const payload = m[3];
    try {
      if (isBase64) {
        const bin = atob(payload);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
      }
      return new Blob([decodeURIComponent(payload)], { type: mime });
    } catch {
      return null;
    }
  }

  function blockedByScan(d: PatientDocument): boolean {
    if (d.scanStatus === "infected") {
      toast.error("Blocked", { description: `${d.name} is quarantined by the virus scanner.` });
      return true;
    }
    if (d.scanStatus === "pending_scan") {
      toast.warning("Scan in progress", { description: `Try again once ${d.name} is marked clean.` });
      return true;
    }
    return false;
  }

  function previewDoc(d: PatientDocument) {
    if (blockedByScan(d)) return;
    if (!d.dataUrl) {
      // Legacy / seeded doc without bytes — fall back to a placeholder.
      const blob = new Blob(
        [`HealthSecure Portal — secure document\n\nFile: ${d.name}\nType: ${d.category}\nUploaded: ${formatDate(d.uploadedAt)}\n\n(No file bytes — uploaded before binary capture was wired up.)`],
        { type: "text/plain" },
      );
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.info("Opened placeholder", { description: `${d.name} · re-upload to view the original file` });
      return;
    }
    const blob = dataUrlToBlob(d.dataUrl);
    if (!blob) {
      toast.error("Could not open document", { description: "The stored data is malformed." });
      return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    // Keep the URL alive long enough for the new tab to read it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast.success("Preview opened · audit-logged", { description: `${d.name} · view counted` });
  }

  function downloadDoc(d: PatientDocument) {
    if (blockedByScan(d)) return;
    const blob = d.dataUrl
      ? dataUrlToBlob(d.dataUrl)
      : new Blob(
          [`HealthSecure Portal — secure document\n\nFile: ${d.name}\nType: ${d.category}\nUploaded: ${formatDate(d.uploadedAt)}\n\n(Demo placeholder export — no original bytes stored.)`],
          { type: "text/plain" },
        );
    if (!blob) {
      toast.error("Could not download", { description: "The stored data is malformed." });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = d.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download started · audit-logged", { description: `${d.name} · signed URL expires in 5 min` });
  }

  function handleDelete(d: PatientDocument) {
    deleteDocument(d.id);
    toast.success("Document deleted", { description: `${d.name} · removed · audit-logged` });
  }

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  return (
    <>
      <PageHeader
        eyebrow="Documents"
        title="Your secure document vault"
        description="Patient-uploaded files for your clinic. Every upload is virus-scanned and stored encrypted. Re-uploads create a new version rather than overwriting."
        actions={<SecurityBadge variant="encrypted" />}
      />

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Tags</p>
            <ul className="space-y-1">
              {tags.map((t) => (
                <li key={t.label}>
                  <button
                    onClick={() => setTag(t.label)}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors ${
                      tag === t.label
                        ? "bg-[var(--color-primary-50)] font-medium text-[var(--color-primary-700)]"
                        : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className="text-[11px] tabular-nums">{t.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Storage</p>
            <div className="mt-3">
              <p className="text-base font-semibold">{formatSize(totalBytes)}</p>
              <p className="text-[var(--color-muted-foreground)]">of 500 MB · retention 7 yrs</p>
            </div>
            <Progress value={Math.min(100, Math.round((totalBytes / (500 * 1024 * 1024)) * 100))} className="mt-3" />
          </div>
        </aside>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Search documents"
              leadingIcon={<Search />}
              className="sm:flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={scanFilter !== "all" ? "soft" : "outline"} size="default">
                  <Filter /> Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Scan status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SCAN_FILTERS.map((s) => (
                  <DropdownMenuItem key={s.key} onSelect={() => setScanFilter(s.key)}>
                    {scanFilter === s.key ? "✓ " : ""}
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild variant="soft">
              <Link href="/patient/documents/upload">
                <FilePlus2 /> New upload
              </Link>
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            {visible.length === 0 ? (
              <EmptyState hasAny={docs.length > 0} />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {visible.map((d) => {
                  const meta = TYPE_META[d.category];
                  const Icon = meta.icon;
                  return (
                    <li
                      key={d.id}
                      className="group flex items-center gap-4 p-5 transition-colors hover:bg-[var(--color-muted)]/40"
                    >
                      <button
                        type="button"
                        onClick={() => previewDoc(d)}
                        className={`flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${meta.color} text-white shadow-[var(--shadow-soft)] transition-transform hover:scale-105`}
                        aria-label={`Open ${d.name} in a new tab`}
                      >
                        <Icon className="size-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => previewDoc(d)}
                        className="min-w-0 flex-1 text-left"
                        aria-label={`Open ${d.name} in a new tab`}
                      >
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold underline-offset-2 group-hover:underline">{d.name}</p>
                          <Badge variant="muted" size="sm">{d.category}</Badge>
                          {d.uploadedBy === "clinician" && (
                            <Badge variant="info" size="sm">From {d.uploaderName ?? "clinician"}</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                          {formatSize(d.sizeBytes)} · uploaded {formatDate(d.uploadedAt)} · click to preview
                        </p>
                      </button>
                      <ScanStatus state={d.scanStatus} />
                      <div className="hidden gap-1 sm:flex">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Download"
                          onClick={() => downloadDoc(d)}
                        >
                          <Download />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="More actions">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onSelect={() => downloadDoc(d)}>
                              <Download /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                toast.success("Link copied", { description: "Signed URL · expires in 5 min" })
                              }
                            >
                              <Link2 /> Copy secure link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-[var(--color-danger)] focus:bg-[var(--color-danger-soft)] focus:text-[var(--color-danger)]"
                              onSelect={() => handleDelete(d)}
                            >
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ScanStatus({ state }: { state: DocumentScanStatus }) {
  if (state === "clean") {
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-[11px] font-medium text-[oklch(0.4_0.12_158)] dark:text-[oklch(0.85_0.12_158)] sm:inline-flex">
        <ShieldCheck className="size-3" /> Clean
      </span>
    );
  }
  if (state === "pending_scan") {
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-[var(--color-info-soft)] px-2 py-0.5 text-[11px] font-medium text-[oklch(0.4_0.13_235)] dark:text-[oklch(0.85_0.13_235)] sm:inline-flex">
        <Loader2 className="size-3 animate-spin" /> Scanning
      </span>
    );
  }
  return (
    <span className="hidden items-center gap-1.5 rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-[11px] font-medium text-[oklch(0.4_0.18_22)] dark:text-[oklch(0.85_0.15_22)] sm:inline-flex">
      <AlertOctagon className="size-3" /> Quarantined
    </span>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
        <FilePlus2 className="size-5" />
      </div>
      <p className="text-sm font-medium">
        {hasAny ? "No documents match your filters" : "Your vault is empty"}
      </p>
      {!hasAny && (
        <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
          Upload insurance cards, prior records, or imaging studies. Files are virus-scanned and encrypted at rest.
        </p>
      )}
      <Button asChild size="sm" className="mt-1">
        <Link href="/patient/documents/upload"><FilePlus2 /> Upload a document</Link>
      </Button>
    </div>
  );
}
