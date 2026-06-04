"use client";

import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  Download,
  ScrollText,
  ShieldCheck,
  FileBarChart2,
  Lock,
  Eye,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReportPayload, ReportSection } from "@/lib/report-types";
import { drawPdfBrandHeader } from "@/lib/brand";

type ReportKey = "compliance_summary" | "access_report" | "consent_compliance" | "audit_summary";

const REPORTS: { key: ReportKey; name: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "compliance_summary", name: "Compliance summary", desc: "Posture, anomalies, policy adoption", icon: ShieldCheck },
  { key: "access_report",      name: "Access report",      desc: "Who accessed which PHI when", icon: ScrollText },
  { key: "consent_compliance", name: "Consent compliance", desc: "Active / revoked / policy coverage", icon: ShieldCheck },
  { key: "audit_summary",      name: "Audit summary",      desc: "Event volume by category & status", icon: FileBarChart2 },
];

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const sec = (Date.now() - Date.parse(iso)) / 1000;
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

export default function AuditorReports() {
  const [lastRun, setLastRun] = useState<Record<ReportKey, string | null>>({
    compliance_summary: null, access_report: null, consent_compliance: null, audit_summary: null,
  });
  const [open, setOpen] = useState<ReportKey | null>(null);
  const [openPayload, setOpenPayload] = useState<ReportPayload | null>(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(
      REPORTS.map((r) =>
        fetch(`/api/auditor/reports/${r.key}`, { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => ({ key: r.key, generatedAt: data?.report?.generatedAt ?? null }))
          .catch(() => ({ key: r.key, generatedAt: null })),
      ),
    ).then((arr) => {
      if (!alive) return;
      setLastRun((curr) => {
        const next = { ...curr };
        for (const { key, generatedAt } of arr) next[key] = generatedAt;
        return next;
      });
    });
    return () => { alive = false; };
  }, []);

  async function fetchPayload(key: ReportKey): Promise<ReportPayload | null> {
    const res = await fetch(`/api/auditor/reports/${key}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      toast.error(data?.error ?? "Could not load report");
      return null;
    }
    return data.report as ReportPayload;
  }

  async function handleView(key: ReportKey) {
    setOpenLoading(true);
    setOpen(key);
    setOpenPayload(null);
    const payload = await fetchPayload(key);
    if (payload) {
      setOpenPayload(payload);
      setLastRun((curr) => ({ ...curr, [key]: payload.generatedAt }));
    }
    setOpenLoading(false);
  }

  async function handleDownload(key: ReportKey, format: "pdf" | "csv") {
    setBusy(`${key}:${format}`);
    try {
      const payload = await fetchPayload(key);
      if (!payload) return;
      setLastRun((curr) => ({ ...curr, [key]: payload.generatedAt }));
      if (format === "pdf") renderPdf(payload);
      else await renderCsv(payload);
      // Log the export so the dashboard's "Generated reports" tile reflects it.
      void fetch("/api/auditor/report-exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportKey: key, format: format === "pdf" ? "pdf" : "xlsx" }),
      }).catch(() => {});
      toast.success(`${payload.title} · ${format === "pdf" ? "PDF" : "Excel"} downloaded`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Reports · live"
        title="Compliance reports"
        description="You can view and export. All four reports pull live data from this tenant's audit ledger, consents, and anomaly engine."
        actions={
          <>
            <SecurityBadge variant="audited" />
            <Badge variant="muted" size="sm"><Lock className="size-3" /> Read-only</Badge>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const rel = relTime(lastRun[r.key]);
          return (
            <div key={r.key} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 text-base font-semibold">{r.name}</h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">{r.desc}</p>
              <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                <Badge variant="muted" size="sm">Last run {rel}</Badge>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="default" size="sm" onClick={() => handleView(r.key)}>
                    <Eye /> View
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy === `${r.key}:pdf`} onClick={() => handleDownload(r.key, "pdf")}>
                    {busy === `${r.key}:pdf` ? <Loader2 className="size-4 animate-spin" /> : <Download />}
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy === `${r.key}:csv`} onClick={() => handleDownload(r.key, "csv")}>
                    {busy === `${r.key}:csv` ? <Loader2 className="size-4 animate-spin" /> : <Download />}
                    Excel
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--color-info)]/30 bg-[var(--color-info-soft)]/30 p-4 text-xs text-[var(--color-muted-foreground)]">
        Every report fetches live data at the moment of view/export. Exports are audit-logged.
      </div>

      <Dialog open={open !== null} onOpenChange={(v) => { if (!v) { setOpen(null); setOpenPayload(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <FileBarChart2 className="size-5" /> {openPayload?.title ?? "Report"}
            </DialogTitle>
            <DialogDescription>
              {openPayload?.description}
              {openPayload?.generatedAtLabel && <> · generated {openPayload.generatedAtLabel}</>}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pt-2">
            {openLoading ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-muted-foreground)]">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </p>
            ) : !openPayload ? (
              <p className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">Report unavailable.</p>
            ) : openPayload.sections.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">No data for this tenant yet.</p>
            ) : (
              openPayload.sections.map((s, i) => <SectionView key={i} section={s} />)
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => open && handleView(open)} disabled={openLoading}>
              <RefreshCw /> Refresh
            </Button>
            <Button variant="outline" onClick={() => open && handleDownload(open, "csv")} disabled={!openPayload || !!busy}>
              <Download /> Excel
            </Button>
            <Button onClick={() => open && handleDownload(open, "pdf")} disabled={!openPayload || !!busy}>
              <Download /> PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SectionView({ section }: { section: ReportSection }) {
  if (section.kind === "paragraph") {
    return (
      <section>
        {section.heading && <h3 className="text-sm font-semibold">{section.heading}</h3>}
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]">{section.text}</p>
      </section>
    );
  }
  if (section.kind === "stats") {
    return (
      <section>
        {section.heading && <h3 className="text-sm font-semibold">{section.heading}</h3>}
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {section.stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-[var(--color-border)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{s.value}</p>
              {s.sub && <p className="text-[11px] text-[var(--color-muted-foreground)]">{s.sub}</p>}
            </div>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section>
      {section.heading && <h3 className="text-sm font-semibold">{section.heading}</h3>}
      {section.rows.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted-foreground)]">
          {section.empty ?? "No rows."}
        </p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-muted)]/40">
              <tr>
                {section.columns.map((c) => (
                  <th key={c} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {section.rows.slice(0, 50).map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => <td key={j} className="px-3 py-2 align-top">{String(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {section.rows.length > 50 && (
            <p className="bg-[var(--color-muted)]/30 px-3 py-2 text-[11px] text-[var(--color-muted-foreground)]">
              Showing 50 of {section.rows.length} — download CSV for the full list.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function safeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9_-]+/g, "_").toLowerCase().slice(0, 60);
}

function renderPdf(report: ReportPayload) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const footerHeight = 32;
  const contentBottom = pageHeight - footerHeight; // pages flow to here, footer below
  let y = margin;

  function drawHeader() {
    doc.setFillColor(15, 91, 102); // brand teal
    doc.rect(0, 0, pageWidth, 70, "F");
    // Brand mark + wordmark (white-on-teal).
    drawPdfBrandHeader(doc, margin, 18, true);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(220, 234, 236);
    doc.text(report.title, margin, 60);
    doc.setFontSize(9);
    doc.text(`Generated ${report.generatedAtLabel ?? report.generatedAt}`, pageWidth - margin, 60, { align: "right" });
  }

  drawHeader();
  y = 100;

  /** Truncate `text` with an ellipsis so its rendered width fits inside maxW. */
  function fitText(text: string, maxW: number): string {
    if (doc.getTextWidth(text) <= maxW) return text;
    const ell = "…";
    let lo = 0, hi = text.length;
    // Binary search for the longest prefix that fits.
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

    // Compute proportional column widths. First pass: estimate each column's
    // ideal width from the longest cell it contains (capped). Second pass:
    // scale to fit the available table width. This avoids the previous
    // "fixed = total / count" behaviour where a long email column ran into a
    // narrow status column.
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
      ideal[i] = widest + 12; // padding
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
    for (let i = 0; i < colCount; i++) { colX.push(xCursor); xCursor += colWidths[i]; }

    // Header row.
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

    // Body.
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
      doc.text(`… ${rows.length - 60} more rows omitted (download CSV for full list)`, margin, y + 12);
      y += 18;
    }
    y += 8;
  }

  for (const s of report.sections) {
    if (s.kind === "paragraph") { if (s.heading) header(s.heading); paragraph(s.text); }
    else if (s.kind === "stats") { if (s.heading) header(s.heading); stats(s.stats); }
    else { if (s.heading) header(s.heading); if (s.rows.length === 0) paragraph(s.empty ?? "No rows."); else table(s.columns, s.rows); }
  }

  // Stamp the footer on every page now that we know the total count. Each
  // page gets: a thin divider line, the report title (left), Page X / Y
  // (centre), and the generated-at + audit-logged note (right).
  // Done as a final pass so single-page reports also get a footer.
  // jsPDF page counting via getNumberOfPages() — set per page.
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

  doc.save(`${safeFilename(report.title)}-${report.generatedAt.slice(0, 10)}.pdf`);
}

/**
 * Generate a styled Excel workbook (.xlsx) for the report. One sheet per
 * report — header band, stats blocks, and table sections all share the
 * teal-on-white palette of the rest of the app. exceljs is loaded
 * dynamically so it's only pulled into the browser bundle when the user
 * actually clicks Excel (it's a ~700KB lib).
 */
async function renderCsv(report: ReportPayload) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "HealthSecure Portal";
  wb.created = new Date();

  const ws = wb.addWorksheet(report.title.slice(0, 31), {
    properties: { tabColor: { argb: "FF0F766E" } },
    views: [{ state: "frozen", ySplit: 4 }],
  });

  // ── Title band (rows 1–2). Unicode shield (🛡) prefix gives the cell a
  // visual brand cue even in clients that won't display embedded images.
  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = "🛡  HealthSecure Portal";
  ws.getCell("A1").font = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5B66" } };
  ws.getCell("A1").alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 32;

  ws.mergeCells("A2:H2");
  ws.getCell("A2").value = `${report.title} · Generated ${report.generatedAtLabel ?? report.generatedAt}`;
  ws.getCell("A2").font = { name: "Calibri", size: 11, color: { argb: "FFFFFFFF" } };
  ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF115E59" } };
  ws.getCell("A2").alignment = { vertical: "middle", indent: 1 };
  ws.getRow(2).height = 22;

  ws.addRow([]);

  function addSectionHeading(heading: string) {
    const row = ws.addRow([heading]);
    row.font = { name: "Calibri", size: 13, bold: true, color: { argb: "FF115E59" } };
    row.height = 22;
    ws.addRow([]);
  }

  function addParagraph(text: string) {
    const r = ws.addRow([text]);
    r.font = { name: "Calibri", size: 10, color: { argb: "FF374151" } };
    r.alignment = { wrapText: true, vertical: "top" };
    r.height = Math.min(80, 18 + Math.floor(text.length / 80) * 14);
    ws.addRow([]);
  }

  function addStats(items: { label: string; value: string; sub?: string }[]) {
    const header = ws.addRow(["Label", "Value", "Sub"]);
    header.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } } as unknown as object as never;
    header.alignment = { vertical: "middle", horizontal: "left" };
    header.height = 20;
    for (const st of items) {
      const row = ws.addRow([st.label, st.value, st.sub ?? ""]);
      row.eachCell((cell, col) => {
        cell.font = { name: "Calibri", size: 10, bold: col === 2 };
        cell.alignment = { vertical: "middle" };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    }
    ws.addRow([]);
  }

  function addTable(columns: string[], rows: (string | number)[][]) {
    // Header row with teal fill + bold white text.
    const headerRow = ws.addRow(columns);
    headerRow.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } } as unknown as object as never;
    headerRow.alignment = { vertical: "middle", horizontal: "left" };
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.border = {
        bottom: { style: "medium", color: { argb: "FF0F766E" } },
      };
    });

    // Body rows with zebra striping.
    rows.forEach((row, idx) => {
      const r = ws.addRow(row);
      const stripe = idx % 2 === 1;
      r.eachCell((cell) => {
        cell.font = { name: "Calibri", size: 10, color: { argb: "FF1F2937" } };
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFF3F4F6" } },
        };
        if (stripe) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFB" } } as unknown as object as never;
        }
        // Status-cell colorisation: success → green, denied/failure → red,
        // anomaly hint → amber. Applied across any column whose value is a
        // known status string.
        const v = String(cell.value ?? "").toLowerCase();
        if (v === "success") {
          cell.font = { ...cell.font, color: { argb: "FF15803D" }, bold: true };
        } else if (v === "denied" || v === "failure") {
          cell.font = { ...cell.font, color: { argb: "FFB91C1C" }, bold: true };
        } else if (v.includes("anomaly")) {
          cell.font = { ...cell.font, color: { argb: "FFB45309" }, bold: true };
        }
      });
    });
    ws.addRow([]);
  }

  // Build sections.
  for (const s of report.sections) {
    if (s.kind === "paragraph") {
      if (s.heading) addSectionHeading(s.heading);
      addParagraph(s.text);
    } else if (s.kind === "stats") {
      if (s.heading) addSectionHeading(s.heading);
      addStats(s.stats);
    } else {
      if (s.heading) addSectionHeading(s.heading);
      if (s.rows.length === 0) addParagraph(s.empty ?? "No rows.");
      else addTable(s.columns, s.rows);
    }
  }

  // Auto-fit column widths based on max content length.
  const maxLens: number[] = [];
  ws.eachRow((row) => {
    row.eachCell((cell, col) => {
      const v = String(cell.value ?? "");
      const len = Math.min(60, v.length);
      maxLens[col - 1] = Math.max(maxLens[col - 1] ?? 10, len + 2);
    });
  });
  ws.columns = maxLens.map((w) => ({ width: w }));

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFilename(report.title)}-${report.generatedAt.slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
