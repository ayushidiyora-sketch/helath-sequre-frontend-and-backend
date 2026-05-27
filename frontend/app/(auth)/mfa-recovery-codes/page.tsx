"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  KeyRound,
  Copy,
  Download,
  Printer,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecurityBadge } from "@/components/shared/security-badge";

const RECOVERY_COUNT = 10;

function generateCodes(seed: number): string[] {
  // Deterministic so re-renders show the same set. In production the codes
  // come from the server with cryptographically-secure randomness.
  let s = seed || Date.now();
  const next = () => {
    s = (s * 1664525 + 1013904223) % 0xffffffff;
    return s;
  };
  const out: string[] = [];
  for (let i = 0; i < RECOVERY_COUNT; i++) {
    const n1 = next().toString(36).padStart(7, "0").slice(-5);
    const n2 = next().toString(36).padStart(7, "0").slice(-5);
    out.push(`${n1}-${n2}`.toUpperCase());
  }
  return out;
}

export default function MfaRecoveryCodesPage() {
  return (
    <Suspense fallback={null}>
      <MfaRecoveryCodesInner />
    </Suspense>
  );
}

function MfaRecoveryCodesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/clinician/dashboard";
  const safeNext = next.startsWith("/") ? next : "/clinician/dashboard";
  const codes = useMemo(() => generateCodes(Date.now()), []);
  const [acknowledged, setAcknowledged] = useState(false);

  function copyAll() {
    void navigator.clipboard
      .writeText(codes.join("\n"))
      .then(() => toast.success("Copied 10 recovery codes to clipboard"))
      .catch(() => toast.error("Couldn't copy to clipboard"));
  }

  function download() {
    const blob = new Blob(
      [
        "HealthSecure Portal — Recovery Codes\n",
        "Issued: " + new Date().toISOString() + "\n",
        "Single-use · keep these somewhere safe.\n\n",
        ...codes.map((c, i) => `${String(i + 1).padStart(2, " ")}. ${c}\n`),
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "healthsecure-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.info("Recovery codes downloaded");
  }

  function print() {
    window.print();
  }

  function continueOn() {
    router.replace(safeNext);
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2.5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-inset ring-[var(--color-primary)]/15">
          <KeyRound className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Save your recovery codes</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Each code is single-use. If you lose access to your authenticator
          app, you&apos;ll need one of these to sign in. They won&apos;t be
          shown again.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-sm text-[oklch(0.4_0.14_75)] dark:text-[oklch(0.85_0.13_80)]">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          Treat these like passwords. Anyone with a code + your password can
          sign in. Store them in a password manager or print and lock away.
        </span>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <ol className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-sm">
          {codes.map((c, i) => (
            <li
              key={c}
              className="flex items-center gap-2 border-b border-[var(--color-border)]/60 py-1.5 last:border-b-0 [&:nth-last-child(2)]:border-b-0"
            >
              <span className="w-5 text-right text-[10px] text-[var(--color-muted-foreground)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="select-all tracking-wider">{c}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copyAll}>
          <Copy /> Copy all
        </Button>
        <Button variant="outline" size="sm" onClick={download}>
          <Download /> Download .txt
        </Button>
        <Button variant="outline" size="sm" onClick={print}>
          <Printer /> Print
        </Button>
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 size-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
        />
        <span className="text-[var(--color-muted-foreground)]">
          I&apos;ve saved my recovery codes somewhere safe. I understand they
          won&apos;t be shown again.
        </span>
      </label>

      <Button size="lg" className="w-full" disabled={!acknowledged} onClick={continueOn}>
        Continue to dashboard <ArrowRight />
      </Button>

      <div className="flex justify-center">
        <SecurityBadge variant="audited" />
      </div>
    </div>
  );
}
