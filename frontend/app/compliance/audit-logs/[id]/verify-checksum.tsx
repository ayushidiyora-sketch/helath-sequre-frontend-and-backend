"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "verifying" | "verified";

/**
 * Interactive verification of an event's append-only checksum chain.
 * Stub for the demo: simulates a 1-second hash-window walk and reports
 * "✓ verified" with the rolling Merkle root.
 */
export function VerifyChecksumButton({
  eventChecksum,
  windowRoot,
}: {
  eventChecksum: string;
  windowRoot: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

  function run() {
    if (status === "verifying") return;
    setStatus("verifying");
    setTimeout(() => {
      setStatus("verified");
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setVerifiedAt(now);
      toast.success("Checksum verified", {
        description: `Event ${eventChecksum} matches window root ${windowRoot} · no tamper`,
      });
    }, 900);
  }

  if (status === "verified") {
    return (
      <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/40 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 font-medium text-[var(--color-success)]">
          <CheckCircle2 className="size-3.5" />
          Checksum verified · no tamper
        </div>
        <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
          Hash chain walked from event → window root. Verified at {verifiedAt}.
        </p>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" className="w-full" onClick={run} disabled={status === "verifying"}>
      {status === "verifying" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" /> Walking hash chain…
        </>
      ) : (
        <>
          <ShieldCheck className="size-3.5" /> Verify checksum
        </>
      )}
    </Button>
  );
}
