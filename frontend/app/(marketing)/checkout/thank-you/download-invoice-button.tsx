"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { renderInvoicePdf, type InvoicePdfData } from "@/lib/invoice-pdf";

/** Client-side "Download invoice" — renders a branded PDF from the order data. */
export function DownloadInvoiceButton({ invoice }: { invoice: InvoicePdfData }) {
  return (
    <Button variant="outline" size="lg" onClick={() => renderInvoicePdf(invoice)}>
      <Download /> Download invoice
    </Button>
  );
}
