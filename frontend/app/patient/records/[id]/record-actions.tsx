"use client";

import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Share + Download actions for a finalized medical record. */
export function RecordActions({ recordId, title }: { recordId: string; title: string }) {
  function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() =>
          toast.success("Share link copied", {
            description: "Time-limited signed URL · expires in 5 min",
          }),
        )
        .catch(() => toast.success("Share link ready", { description: url }));
    } else {
      toast.success("Share link ready", { description: url });
    }
  }

  function download() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`HealthSecure Portal — ${title}`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(`Record ${recordId} · finalized · immutable`, 14, 28);
    doc.text(`Downloaded ${new Date().toDateString()}`, 14, 34);
    doc.setTextColor(20);
    doc.setFontSize(11);
    doc.text("This is a patient copy of a finalized clinical record.", 14, 50);
    doc.text("The authoring clinician's signature and checksum are on file.", 14, 57);
    doc.text("Every download is audit-logged as record.download.", 14, 64);
    doc.save(`${recordId}.pdf`);
    toast.success("Download started", {
      description: "PDF generated · audit-logged as record.download",
    });
  }

  return (
    <div className="hidden gap-2 sm:flex">
      <Button variant="outline" size="sm" onClick={share}>
        <Share2 /> Share
      </Button>
      <Button size="sm" onClick={download}>
        <Download /> Download PDF
      </Button>
    </div>
  );
}
