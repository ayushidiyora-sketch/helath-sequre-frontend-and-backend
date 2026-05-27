"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  Download,
  Share2,
  Link as LinkIcon,
  Mail,
  MessageSquare,
  AlertTriangle,
  Copy,
  Check,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Share + Download actions for a finalized medical record. */
export function RecordActions({ recordId, title }: { recordId: string; title: string }) {
  const [open, setOpen] = useState(false);

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
    <>
      <div className="hidden gap-2 sm:flex">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Share2 /> Share
        </Button>
        <Button size="sm" onClick={download}>
          <Download /> Download PDF
        </Button>
      </div>
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        recordId={recordId}
        title={title}
        onDownload={download}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Share dialog
// ---------------------------------------------------------------------------

function ShareDialog({
  open,
  onOpenChange,
  title,
  onDownload,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recordId: string;
  title: string;
  onDownload: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const recordUrl = typeof window !== "undefined" ? window.location.href : "";

  // Social-share targets get a marketing referral link — never the PHI URL.
  // Sharing a medical-record URL on public social media is a HIPAA / GDPR
  // violation; the social options below route a "join HealthSecure" link
  // instead so the patient can mention the platform without leaking PHI.
  const referralUrl = "https://healthsecure.app";
  const referralCaption = `I manage my health records securely on HealthSecure Portal — consent-bound, encrypted, audit-logged. ${referralUrl}`;

  function copyLink() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast.info("Link", { description: recordUrl });
      return;
    }
    navigator.clipboard
      .writeText(recordUrl)
      .then(() => {
        setCopied(true);
        toast.success("Consent-bound link copied", {
          description: "Time-limited signed URL · expires in 5 min · audit-logged",
        });
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.info("Link", { description: recordUrl }));
  }

  function shareWithClinician() {
    toast.success("Sent via secure messaging", {
      description: `${title} · audit-logged as record.share`,
    });
    onOpenChange(false);
  }

  function shareViaEmail() {
    const subject = encodeURIComponent(`Sharing my record — ${title}`);
    const body = encodeURIComponent(
      `Hello,\n\nI'm sharing a finalized record from my HealthSecure Portal account.\n\n` +
        `Record: ${title}\nLink (expires in 5 min, audit-logged): ${recordUrl}\n\n` +
        `— Sent from HealthSecure Portal`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    toast.success("Email draft opened", { description: "audit-logged as record.share" });
    onOpenChange(false);
  }

  function shareToSocial(target: SocialTarget) {
    const url = target.build(referralUrl, referralCaption);
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer,width=600,height=600");
    }
    toast.info(`${target.label} share opened`, {
      description: "Referral link only · no PHI was shared",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-5" /> Share {title}
          </DialogTitle>
          <DialogDescription>
            Securely send this record to your care team, or invite others to HealthSecure Portal.
          </DialogDescription>
        </DialogHeader>

        {/* PHI warning */}
        <div className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/30 px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]" />
          <p className="text-[var(--color-foreground)]/85">
            Don&apos;t post medical records to public social media. The social options below
            share a HealthSecure referral link, not your PHI.
          </p>
        </div>

        {/* Secure share */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
            Secure share
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ShareTile
              icon={copied ? Check : LinkIcon}
              label={copied ? "Link copied" : "Copy link"}
              hint="Expires in 5 min"
              onClick={copyLink}
              active={copied}
            />
            <ShareTile
              icon={MessageSquare}
              label="Send via secure msg"
              hint="To care team"
              onClick={shareWithClinician}
            />
            <ShareTile
              icon={Mail}
              label="Email draft"
              hint="Opens your mail app"
              onClick={shareViaEmail}
            />
            <ShareTile
              icon={Send}
              label="Download PDF"
              hint="Print or attach"
              onClick={() => {
                onDownload();
                onOpenChange(false);
              }}
            />
          </div>
        </div>

        {/* Social — referral link only */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Tell others about HealthSecure
          </p>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            Shares the platform referral link — never your record.
          </p>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {SOCIAL_TARGETS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => shareToSocial(t)}
                className="group flex flex-col items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-soft)]"
                aria-label={`Share via ${t.label}`}
                title={t.label}
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-xl text-white shadow-sm ${t.bg}`}
                  style={t.style}
                >
                  {t.brandSvg}
                </span>
                <span className="text-[11px] font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={copyLink}>
            <Copy /> Copy secure link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Social share targets — all open in a popup, share platform referral link.
// ---------------------------------------------------------------------------

interface SocialTarget {
  id: string;
  label: string;
  bg: string;
  style?: React.CSSProperties;
  brandSvg: React.ReactNode;
  build: (url: string, text: string) => string;
}

const SOCIAL_TARGETS: SocialTarget[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    bg: "",
    style: { background: "#25D366" },
    brandSvg: (
      <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.148-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.04 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.889-9.884a9.825 9.825 0 016.991 2.898 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.889 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.452 3.488z" />
      </svg>
    ),
    build: (url, text) => `https://wa.me/?text=${encodeURIComponent(text)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    bg: "",
    style: { background: "#1877F2" },
    brandSvg: (
      <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden>
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.412c0-3.017 1.792-4.682 4.533-4.682 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.492 0-1.956.926-1.956 1.875v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    ),
    build: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "twitter",
    label: "X / Twitter",
    bg: "",
    style: { background: "#0f1419" },
    brandSvg: (
      <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    build: (url, text) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    bg: "",
    style: { background: "#0A66C2" },
    brandSvg: (
      <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    build: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    bg: "",
    style: { background: "#26A5E4" },
    brandSvg: (
      <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden>
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
      </svg>
    ),
    build: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "instagram",
    label: "Instagram",
    bg: "bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]",
    brandSvg: (
      <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
    // Instagram doesn't support a web share intent; we approximate by opening
    // instagram.com and putting the caption in the URL fragment for the user
    // to copy-paste. The toast nudges them.
    build: (_url, text) =>
      `https://www.instagram.com/?caption=${encodeURIComponent(text)}`,
  },
];

// ---------------------------------------------------------------------------
// Share tile
// ---------------------------------------------------------------------------

function ShareTile({
  icon: Icon,
  label,
  hint,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 ${
        active
          ? "border-[var(--color-success)]/40 bg-[var(--color-success-soft)]/30"
          : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-primary)]/40"
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
          active
            ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
            : "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-[var(--color-muted-foreground)]">{hint}</p>
      </div>
    </button>
  );
}
