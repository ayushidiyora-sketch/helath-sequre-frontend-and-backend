"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { loginHrefForPath } from "@/lib/login-href";

/**
 * Sign-out control. Revokes the server session, clears the cookie, then sends
 * the user back to the role-appropriate sign-in page (/login for patients,
 * /staff-login for clinical+admin staff, /super-login for platform operators).
 *
 * Rendered inside a DropdownMenuItem via `asChild`, so it MUST forward its ref
 * and spread Radix's injected props (ref, data-radix-collection-item, role,
 * tabIndex, focus handlers…) onto the underlying <button>. Without the ref,
 * Radix's focus scope calls `.focus()` on a null node and the menu crashes
 * ("Cannot read properties of null (reading 'focus')").
 */
export const LogoutButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button">
>(function LogoutButton({ className, onClick, ...props }, ref) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  async function handleLogout(e: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(e); // let the menu item's select/close handler run too
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the network call fails, fall through to the login page —
      // the cookie is httpOnly so the client can't be left in a half state.
    }
    router.push(loginHrefForPath(pathname));
    router.refresh();
  }

  return (
    <button
      ref={ref}
      type="button"
      {...props}
      onClick={handleLogout}
      disabled={busy}
      className={className}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Sign out
    </button>
  );
});
