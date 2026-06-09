"use client";

import { jsPDF } from "jspdf";

export interface InvoicePdfData {
  number: string | null;
  tierName: string;
  cycle: string;
  qty?: number;
  amountCents: number;
  currency: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
  transactionId: string;
  billingName?: string | null;
  billingEmail?: string | null;
  orgName?: string | null;
  status?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  createdAt?: string | null;
}

const TAX_RATE = 0.09; // matches checkout

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "usd").toUpperCase() }).format(cents / 100);
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Render a branded, professional HealthSecure invoice PDF and download it. */
export function renderInvoicePdf(inv: InvoicePdfData): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const teal: [number, number, number] = [15, 91, 102];
  const dark: [number, number, number] = [24, 24, 27];
  const muted: [number, number, number] = [120, 120, 128];
  const line: [number, number, number] = [228, 228, 232];

  const label = (t: string, x: number, y: number, align: "left" | "right" = "left") => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text(t.toUpperCase(), x, y, { align });
  };
  const text = (t: string, x: number, y: number, size = 11, bold = false, color = dark, align: "left" | "right" = "left") => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    doc.text(t, x, y, { align });
  };

  // ── Header band ───────────────────────────────────────────────
  doc.setFillColor(...teal);
  doc.rect(0, 0, W, 104, "F");
  // Logo mark
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, 34, 26, 26, 6, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...teal);
  doc.text("H", M + 7.5, 53);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(17);
  doc.text("HealthSecure Portal", M + 38, 48);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(206, 226, 228);
  doc.text("Secure clinical platform · billing", M + 38, 64);
  // Right: INVOICE + number + status pill
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(206, 226, 228);
  doc.text("INVOICE", W - M, 42, { align: "right" });
  doc.setFontSize(14); doc.setTextColor(255, 255, 255);
  doc.text(inv.number ?? "Receipt", W - M, 60, { align: "right" });
  const paid = (inv.status ?? "paid").toLowerCase() === "paid";
  const pillText = (inv.status ?? "paid").toUpperCase();
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  const pw = doc.getTextWidth(pillText) + 18;
  doc.setFillColor(paid ? 209 : 250, paid ? 250 : 240, paid ? 223 : 209);
  doc.roundedRect(W - M - pw, 72, pw, 16, 8, 8, "F");
  doc.setTextColor(paid ? 21 : 140, paid ? 128 : 90, paid ? 61 : 20);
  doc.text(pillText, W - M - pw / 2, 83, { align: "center" });

  // ── Bill-to / details ─────────────────────────────────────────
  let y = 146;
  label("Billed to", M, y);
  label("Invoice details", W - M, y, "right");
  y += 18;
  text(inv.billingName || "—", M, y, 12, true);
  text("Issued", W - M - 150, y, 9, true, muted);
  text(fmtDate(inv.createdAt ?? inv.periodStart), W - M, y, 11, false, dark, "right");
  y += 16;
  if (inv.orgName) { text(inv.orgName, M, y, 10.5, false, dark); }
  text("Billing period", W - M - 150, y, 9, true, muted);
  text(`${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}`, W - M, y, 9.5, false, dark, "right");
  y += 15;
  if (inv.billingEmail) { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...muted); doc.text(inv.billingEmail, M, y); }

  // ── Line items ────────────────────────────────────────────────
  y += 34;
  doc.setFillColor(245, 246, 247);
  doc.rect(M, y, W - 2 * M, 24, "F");
  label("Description", M + 12, y + 15);
  label("Qty", W - M - 150, y + 15, "right");
  label("Amount", W - M - 12, y + 15, "right");
  y += 24;
  doc.setDrawColor(...line); doc.line(M, y, W - M, y);
  y += 22;
  text(`${inv.tierName} — ${inv.cycle === "annual" ? "Annual" : "Monthly"}`, M + 12, y, 11, false);
  text(String(inv.qty ?? 1), W - M - 150, y, 11, false, dark, "right");
  text(money(inv.amountCents, inv.currency), W - M - 12, y, 11, false, dark, "right");
  y += 12;
  doc.setDrawColor(...line); doc.line(M, y, W - M, y);

  // ── Totals box (right) ────────────────────────────────────────
  const subtotal = Math.round(inv.amountCents / (1 + TAX_RATE));
  const tax = inv.amountCents - subtotal;
  const boxW = 220;
  const boxX = W - M - boxW;
  y += 18;
  const row = (l: string, v: string, bold = false, big = false) => {
    text(l, boxX, y, big ? 12 : 10, bold, bold ? dark : muted);
    text(v, W - M, y, big ? 14 : 10.5, bold, dark, "right");
    y += big ? 6 : 18;
  };
  row("Subtotal", money(subtotal, inv.currency));
  row(`Tax (GST/VAT ${Math.round(TAX_RATE * 100)}%)`, money(tax, inv.currency));
  y += 4;
  doc.setDrawColor(...line); doc.line(boxX, y, W - M, y);
  y += 20;
  row("Total paid", money(inv.amountCents, inv.currency), true, true);

  // ── Payment + transaction ─────────────────────────────────────
  y += 40;
  label("Payment method", M, y);
  label("Transaction ID", M + 240, y);
  y += 16;
  text(inv.cardBrand ? `${inv.cardBrand.toUpperCase()} ···· ${inv.cardLast4 ?? "----"}` : "Card", M, y, 11, false);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...muted);
  doc.text(inv.transactionId || "—", M + 240, y);

  // ── Footer ────────────────────────────────────────────────────
  doc.setDrawColor(...line); doc.line(M, H - 60, W - M, H - 60);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...muted);
  doc.text("Thank you for your business. Payment processed securely by Stripe.", M, H - 42);
  doc.text("This is a system-generated invoice · audit-logged · HealthSecure Portal", M, H - 30);

  const safe = (inv.number ?? inv.transactionId ?? "invoice").replace(/[^a-zA-Z0-9_-]+/g, "_");
  doc.save(`${safe}.pdf`);
}
