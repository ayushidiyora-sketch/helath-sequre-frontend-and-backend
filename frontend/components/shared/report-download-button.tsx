"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { REPORT_REGISTRY, type ReportKey } from "@/lib/report-generators";

interface ReportDownloadButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Which report to generate */
  report: ReportKey;
  /** PDF (default) or CSV */
  format?: "pdf" | "csv";
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
  children,
  ...buttonProps
}: ReportDownloadButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const def = REPORT_REGISTRY[report];

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    const tid = toast.loading(`Generating ${def.name} · ${format.toUpperCase()}`, {
      description: "Aggregating data + signing checksum…",
    });

    // Yield so the loading toast can paint before the (sync) jsPDF render
    await new Promise((r) => setTimeout(r, 200));

    try {
      const result = format === "pdf" ? def.pdf() : def.csv();
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
