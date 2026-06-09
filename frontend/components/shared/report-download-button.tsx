"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { REPORT_REGISTRY, type ReportKey } from "@/lib/report-generators";
import { renderReportPdf, renderReportCsv } from "@/lib/report-pdf";
import type { ReportPayload } from "@/lib/report-types";

interface ReportDownloadButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Which report to generate */
  report: ReportKey;
  /** PDF (default) or CSV */
  format?: "pdf" | "csv";
  /**
   * When set, fetch live tenant data from `/api/<source>/reports/[key]` and
   * render the brand PDF from that payload. Falls back to the legacy static
   * generator in `lib/report-generators.ts` if no source is given (older
   * marketing pages, demo screens, etc.).
   */
  source?: "admin" | "auditor";
  /** Children rendered inside the button */
  children?: React.ReactNode;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ReportDownloadButton({
  report,
  format = "pdf",
  source,
  children,
  ...buttonProps
}: ReportDownloadButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const def = REPORT_REGISTRY[report];

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    const tid = toast.loading(`Generating ${def.name} · ${format.toUpperCase()}`, {
      description: source ? "Pulling live tenant data…" : "Aggregating data + signing checksum…",
    });

    try {
      let result: { filename: string; size: number };

      if (source) {
        // Dynamic path — fetch live data, render with the shared payload-driven
        // renderer. Server returns a ReportPayload populated with the caller's
        // tenant numbers.
        const r = await fetch(`/api/${source}/reports/${report}`, { cache: "no-store" });
        const json = (await r.json()) as {
          ok: boolean;
          error?: string;
          payload?: ReportPayload;
        };
        if (!r.ok || !json.ok || !json.payload) {
          throw new Error(json.error ?? `Failed to load report data (HTTP ${r.status}).`);
        }
        // Yield so the loading toast can paint before the (sync) jsPDF render
        await new Promise((rs) => setTimeout(rs, 50));
        result =
          format === "pdf" ? renderReportPdf(json.payload) : renderReportCsv(json.payload);

        // Best-effort: record this download in report_exports so the
        // /admin/reports "Last run" pill reflects reality. Only fire for
        // admin context — auditor side has its own export-logging hook.
        if (source === "admin") {
          fetch("/api/auditor/report-exports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reportKey: report, format }),
          }).catch(() => {});
        }
      } else {
        // Yield so the loading toast can paint before the (sync) jsPDF render
        await new Promise((rs) => setTimeout(rs, 200));
        result = format === "pdf" ? def.pdf() : def.csv();
      }

      toast.success(`${def.name} · downloaded`, {
        id: tid,
        description: `${result.filename} · ${formatBytes(result.size)} · audit-logged`,
      });
    } catch (e) {
      toast.error("Report generation failed", {
        id: tid,
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button {...buttonProps} onClick={handleClick} disabled={busy || buttonProps.disabled}>
      {children}
    </Button>
  );
}
