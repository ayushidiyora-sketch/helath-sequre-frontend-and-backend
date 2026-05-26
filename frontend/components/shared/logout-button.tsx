"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { loginHrefForPath } from "@/lib/login-href";

/**
 * Sign-out control. Revokes the server session, clears the cookie, then sends
 * the user back to the role-appropriate sign-in page (/login for patients,
 * /staff-login for clinical+admin staff, /super-login for platform operators).
 * Rendered inside a DropdownMenuItem via `asChild`, so it forwards the
 * menu-item styling onto a plain <button>.
 */
export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
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
    <button type="button" onClick={handleLogout} disabled={busy} className={className}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Sign out
    </button>
  );
}
