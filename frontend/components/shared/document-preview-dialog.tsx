"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImagingViewer } from "@/components/shared/imaging-viewer";

export interface PreviewDoc {
  id: string;
  name: string;
  category?: string;
  mimeType?: string | null;
  dataUrl?: string | null;
  sizeBytes?: number;
}

type Kind = "image" | "pdf" | "dicom" | "other";

function kindOf(doc: PreviewDoc): Kind {
  const mime = (doc.mimeType ?? "").toLowerCase();
  const name = doc.name.toLowerCase();
  if (/\.dcm$/.test(name) || mime.includes("dicom")) return "dicom";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/.test(name)) return "image";
  if (mime === "application/pdf" || /\.pdf$/.test(name)) return "pdf";
  return "other";
}

function dataUrlToBlobUrl(dataUrl: string): string | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl);
  if (!m) return null;
  try {
    const mime = m[1] || "application/octet-stream";
    if (m[2]) {
      const bin = atob(m[3]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    }
    return URL.createObjectURL(new Blob([decodeURIComponent(m[3])], { type: mime }));
  } catch {
    return null;
  }
}

/**
 * Inline document preview. Images render in the zoomable/pannable ImagingViewer
 * (the same surface used for medical imaging), PDFs in an embedded iframe, and
 * DICOM / unsupported types fall back to a metadata card with download — since
 * browsers can't render DICOM natively. Replaces the previous "dump to a new
 * browser tab" behaviour with a real in-app preview surface.
 */
export function DocumentPreviewDialog({
  doc,
  open,
  onOpenChange,
  onDownload,
  onOpenInNewTab,
}: {
  doc: PreviewDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (doc: PreviewDoc) => void;
  onOpenInNewTab?: (doc: PreviewDoc) => void;
}) {
  const kind = doc ? kindOf(doc) : "other";

  // PDFs need a same-origin Blob URL for the iframe.
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!doc || kind !== "pdf" || !doc.dataUrl) {
      setPdfUrl(null);
      return;
    }
    const url = dataUrlToBlobUrl(doc.dataUrl);
    setPdfUrl(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc, kind]);

  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="truncate">{doc.name}</DialogTitle>
            {doc.category && <Badge variant="muted" size="sm">{doc.category}</Badge>}
          </div>
          <DialogDescription>
            {doc.mimeType ?? "Unknown type"}
            {doc.sizeBytes ? ` · ${formatSize(doc.sizeBytes)}` : ""} · preview is audit-logged
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[300px]">
          {!doc.dataUrl ? (
            <Fallback
              icon={FileWarning}
              title="No file bytes stored"
              body="This document was added before binary capture was wired up. Re-upload to preview the original."
            />
          ) : kind === "image" ? (
            <ImagingViewer
              images={[{ id: doc.id, label: doc.name, src: doc.dataUrl }]}
              modality={doc.category}
            />
          ) : kind === "pdf" ? (
            pdfUrl ? (
              <iframe title={doc.name} src={pdfUrl} className="h-[60vh] w-full rounded-xl border border-[var(--color-border)]" />
            ) : (
              <Fallback icon={FileWarning} title="Could not render PDF" body="The stored data is malformed." />
            )
          ) : kind === "dicom" ? (
            <Fallback
              icon={FileWarning}
              title="DICOM file"
              body="DICOM images can't be rendered in the browser. Download to open in a dedicated DICOM viewer."
            />
          ) : (
            <Fallback
              icon={FileText}
              title="Preview not available"
              body="This file type can't be previewed inline. Download it to view."
            />
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {onOpenInNewTab && (
            <Button variant="ghost" size="sm" onClick={() => onOpenInNewTab(doc)}>
              <ExternalLink /> Open in new tab
            </Button>
          )}
          {onDownload && (
            <Button variant="outline" size="sm" onClick={() => onDownload(doc)}>
              <Download /> Download
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Fallback({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof FileText;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
        <Icon className="size-6" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-[var(--color-muted-foreground)]">{body}</p>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
