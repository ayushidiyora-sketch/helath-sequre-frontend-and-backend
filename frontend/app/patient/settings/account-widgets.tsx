"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Copy, Download, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

/**
 * "Change photo" — opens a real image picker and PATCHes the profile with the
 * picked image as a data URL. The parent supplies `onPicked(dataUrl, name)`
 * which decides where to send the upload (PATCH /api/patient/profile here).
 */
export function ChangePhotoButton({ onPicked }: { onPicked?: (dataUrl: string, name: string) => void | Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 2 * 1024 * 1024) {
            toast.error("Photo must be 2 MB or smaller.");
            return;
          }
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = String(reader.result ?? "");
            if (!dataUrl.startsWith("data:image/")) {
              toast.error("Could not read the image.");
              return;
            }
            setBusy(true);
            try {
              await onPicked?.(dataUrl, f.name);
            } finally {
              setBusy(false);
            }
          };
          reader.onerror = () => toast.error("Could not read the image.");
          reader.readAsDataURL(f);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="mt-4 w-full"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? "Uploading…" : "Change photo"}
      </Button>
    </>
  );
}

const RECOVERY_CODES = [
  "4f9a-2c1d", "8b3e-7a6f", "1d5c-9e2b", "6a8f-3c4d", "2e7b-5d9a",
  "9c1a-4f8e", "3b6d-2a7c", "7e4f-1c5b", "5a9c-8d3e", "0d2b-6f1a",
];

/** "View recovery codes" — opens a dialog with single-use codes. */
export function RecoveryCodesButton() {
  function copyAll() {
    navigator.clipboard?.writeText(RECOVERY_CODES.join("\n"));
    toast.success("Recovery codes copied");
  }
  function downloadCodes() {
    const blob = new Blob(
      [`HealthSecure Portal — recovery codes\n\n${RECOVERY_CODES.join("\n")}\n\nEach code is single-use. Store them somewhere safe.`],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "healthsecure-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Recovery codes downloaded");
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          View recovery codes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Recovery codes</DialogTitle>
          <DialogDescription>
            Each code can be used once if you lose access to your authenticator. Store them somewhere safe.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {RECOVERY_CODES.map((c) => (
            <code
              key={c}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-2.5 py-1.5 text-center font-mono text-sm"
            >
              {c}
            </code>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={copyAll}>
            <Copy /> Copy
          </Button>
          <Button onClick={downloadCodes}>
            <Download /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Add passkey" — opens a dialog that simulates WebAuthn enrollment. */
export function AddPasskeyButton() {
  const [open, setOpen] = useState(false);
  const [registering, setRegistering] = useState(false);

  function register() {
    setRegistering(true);
    setTimeout(() => {
      setRegistering(false);
      setOpen(false);
      toast.success("Passkey added", { description: "This device can now sign in without a password" });
    }, 1200);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add passkey</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Register a passkey</DialogTitle>
          <DialogDescription>
            A passkey lets you sign in with your device&apos;s fingerprint, face, or PIN — phishing-resistant and device-bound.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-4">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
            {registering ? (
              <KeyRound className="size-7 animate-pulse" />
            ) : (
              <Fingerprint className="size-7" />
            )}
          </span>
          <p className="text-center text-sm text-[var(--color-muted-foreground)]">
            {registering
              ? "Waiting for your device — confirm with biometric or PIN…"
              : "Your browser will prompt you to use this device's biometric."}
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={registering}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={register} disabled={registering}>
            <Fingerprint /> {registering ? "Registering…" : "Register passkey"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
