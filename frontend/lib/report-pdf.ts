"use client";

import { jsPDF } from "jspdf";
import { drawPdfBrandHeader } from "@/lib/brand";
import type { ReportPayload } from "@/lib/report-types";

/**
 * Shared PDF renderer for the section-based `ReportPayload` shape.
 * Originally lived inside `app/auditor/reports/page.tsx`; lifted out so the
 * Org Admin reports page (and any other future report surface) can render
 * the same brand-styled PDF from server-supplied tenant data.
 */

export function safeFilename(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .toLowerCase()
    .slice(0, 60);
}

/**
 * Render `report` to a PDF and trigger a browser download.
 * Returns `{ filename, size }` so the caller can show that in a toast.
 */
export function renderReportPdf(report: ReportPayload): { filename: string; size: number } {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const footerHeight = 32;
  const contentBottom = pageHeight - footerHeight;
  let y = margin;

  function drawHeader() {
    doc.setFillColor(15, 91, 102); // brand teal
    doc.rect(0, 0, pageWidth, 70, "F");
    drawPdfBrandHeader(doc, margin, 18, true);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(220, 234, 236);
    doc.text(report.title, margin, 60);
    doc.setFontSize(9);
    doc.text(
      `Generated ${report.generatedAtLabel ?? report.generatedAt}`,
      pageWidth - margin,
      60,
      { align: "right" },
    );
  }

  drawHeader();
  y = 100;

  function fitText(text: string, maxW: number): string {
    if (doc.getTextWidth(text) <= maxW) return text;
    const ell = "…";
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (doc.getTextWidth(text.slice(0, mid) + ell) <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo) + ell;
  }

  function ensureSpace(needed: number) {
    if (y + needed > contentBottom) {
      doc.addPage();
      drawHeader();
      y = 100;
    }
  }

  function header(text: string) {
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(text, margin, y);
    y += 18;
  }

  function paragraph(text: string) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const wrapped = doc.splitTextToSize(text, pageWidth - margin * 2);
    ensureSpace(wrapped.length * 14 + 12);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 14 + 12;
  }

  function stats(items: { label: string; value: string }[]) {
    const colWidth = (pageWidth - margin * 2) / 2;
    items.forEach((it, idx) => {
      const col = (idx % 2) as 0 | 1;
      const row = Math.floor(idx / 2);
      const x = margin + col * colWidth;
      const yy = y + row * 36;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(it.label.toUpperCase(), x, yy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text(fitText(it.value, colWidth - 12), x, yy + 14);
    });
    y += Math.ceil(items.length / 2) * 36 + 8;
  }

  function table(columns: string[], rows: (string | number)[][]) {
    const colCount = columns.length;
    const tableW = pageWidth - margin * 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const ideal: number[] = [];
    for (let i = 0; i < colCount; i++) {
      let widest = doc.getTextWidth(columns[i].toUpperCase());
      for (const row of rows.slice(0, 80)) {
        const t = String(row[i] ?? "");
        const w = doc.getTextWidth(t.length > 60 ? t.slice(0, 60) : t);
        if (w > widest) widest = w;
      }
      ideal[i] = widest + 12;
    }
    const sum = ideal.reduce((a, b) => a + b, 0);
    const minColW = 36;
    const colWidths = ideal.map((w) => {
      const scaled = (w / sum) * tableW;
      return Math.max(minColW, scaled);
    });
    const finalSum = colWidths.reduce((a, b) => a + b, 0);
    if (finalSum !== tableW) {
      const factor = tableW / finalSum;
      for (let i = 0; i < colWidths.length; i++) colWidths[i] *= factor;
    }
    const colX: number[] = [];
    let xCursor = margin;
    for (let i = 0; i < colCount; i++) {
      colX.push(xCursor);
      xCursor += colWidths[i];
    }

    ensureSpace(24);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, tableW, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    for (let i = 0; i < colCount; i++) {
      doc.text(fitText(columns[i].toUpperCase(), colWidths[i] - 8), colX[i] + 4, y + 14);
    }
    y += 26;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    for (const row of rows.slice(0, 60)) {
      ensureSpace(18);
      for (let i = 0; i < colCount; i++) {
        const text = String(row[i] ?? "");
        doc.text(fitText(text, colWidths[i] - 8), colX[i] + 4, y + 12);
      }
      y += 18;
    }
    if (rows.length > 60) {
      ensureSpace(18);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `… ${rows.length - 60} more rows omitted (download CSV for full list)`,
        margin,
        y + 12,
      );
      y += 18;
    }
    y += 8;
  }

  for (const s of report.sections) {
    if (s.kind === "paragraph") {
      if (s.heading) header(s.heading);
      paragraph(s.text);
    } else if (s.kind === "stats") {
      if (s.heading) header(s.heading);
      stats(s.stats);
    } else {
      if (s.heading) header(s.heading);
      if (s.rows.length === 0) paragraph(s.empty ?? "No rows.");
      else table(s.columns, s.rows);
    }
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const fy = pageHeight - 18;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, fy - 12, pageWidth - margin, fy - 12);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`HealthSecure Portal · ${report.title} · audit-logged`, margin, fy);
    doc.text(`Page ${p} of ${pages}`, pageWidth / 2, fy, { align: "center" });
    doc.text(
      `Generated ${report.generatedAtLabel ?? report.generatedAt}`,
      pageWidth - margin,
      fy,
      { align: "right" },
    );
  }

  const filename = `${safeFilename(report.title)}-${report.generatedAt.slice(0, 10)}.pdf`;
  doc.save(filename);
  const out = doc.output("arraybuffer");
  return { filename, size: out.byteLength };
}

/**
 * Render the payload as a CSV row dump. Best-effort — flattens stats + table
 * sections into a single column-aligned CSV. Used when an admin clicks the
 * lightweight CSV button on the reports page.
 */
export function renderReportCsv(report: ReportPayload): { filename: string; size: number } {
  const lines: string[] = [];
  lines.push([report.title, report.generatedAtLabel ?? report.generatedAt].join(","));
  lines.push("");
  for (const s of report.sections) {
    if (s.heading) lines.push(`# ${s.heading}`);
    if (s.kind === "paragraph") {
      lines.push(quoteCsv(s.text));
      lines.push("");
    } else if (s.kind === "stats") {
      for (const it of s.stats) {
        lines.push([quoteCsv(it.label), quoteCsv(it.value), quoteCsv(it.sub ?? "")].join(","));
      }
      lines.push("");
    } else {
      lines.push(s.columns.map(quoteCsv).join(","));
      for (const row of s.rows) {
        lines.push(row.map((c) => quoteCsv(String(c))).join(","));
      }
      lines.push("");
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const filename = `${safeFilename(report.title)}-${report.generatedAt.slice(0, 10)}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { filename, size: blob.size };
}

function quoteCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
