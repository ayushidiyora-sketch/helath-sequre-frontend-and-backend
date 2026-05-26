"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "info" | "warning" | "error";

interface ActionButtonProps extends Omit<ButtonProps, "onClick" | "asChild"> {
  /** Toast message to show on click (success-styled by default) */
  toastMessage?: string;
  toastDescription?: string;
  toastVariant?: ToastVariant;
  /** If provided, click navigates to this href instead of running other handlers */
  href?: string;
  /** Open href in new tab */
  external?: boolean;
  /** Show a confirmation dialog before firing the action */
  confirm?: {
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "destructive";
  };
  /** Optional click handler — runs after confirm/toast wiring */
  onClick?: () => void;
}

export function ActionButton({
  toastMessage,
  toastDescription,
  toastVariant = "success",
  href,
  external,
  confirm,
  onClick,
  children,
  ...buttonProps
}: ActionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const run = React.useCallback(() => {
    if (toastMessage) {
      const fn =
        toastVariant === "success"
          ? toast.success
          : toastVariant === "warning"
            ? toast.warning
            : toastVariant === "error"
              ? toast.error
              : toast.info;
      fn(toastMessage, toastDescription ? { description: toastDescription } : undefined);
    }
    if (href) {
      if (external) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        router.push(href);
      }
    }
    onClick?.();
  }, [toastMessage, toastDescription, toastVariant, href, external, onClick, router]);

  const handleClick = React.useCallback(() => {
    if (confirm) {
      setOpen(true);
    } else {
      run();
    }
  }, [confirm, run]);

  // Always render as a real <button>. Navigation goes through router.push
  // (or window.open for external) inside run(). This avoids producing an
  // <a> element, which would break hydration whenever ActionButton is used
  // inside another <Link>. For pure navigation without action wiring, use
  // <Link> directly — ActionButton is for actions.
  return (
    <>
      <Button {...buttonProps} onClick={handleClick}>
        {children}
      </Button>

      {confirm && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${confirm.variant === 'destructive' ? 'from-[var(--color-danger-soft)] to-[var(--color-danger-soft)]' : 'from-[var(--color-primary-50)] to-[var(--color-primary-50)]'}">
                {confirm.variant === "destructive" ? (
                  <AlertTriangle className={cn("size-5 text-[var(--color-danger)]")} />
                ) : (
                  <ShieldCheck className="size-5 text-[var(--color-primary-700)]" />
                )}
              </div>
              <DialogTitle>{confirm.title}</DialogTitle>
              <DialogDescription>{confirm.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {confirm.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={confirm.variant === "destructive" ? "destructive" : "default"}
                onClick={() => {
                  setOpen(false);
                  run();
                }}
              >
                {confirm.confirmLabel ?? "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
