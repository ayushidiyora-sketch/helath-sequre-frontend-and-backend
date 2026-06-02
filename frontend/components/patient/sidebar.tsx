"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Calendar,
  FolderLock,
  Shield,
  MessageSquare,
  Settings,
  Bell,
  LifeBuoy,
  Pill,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { LogoutButton } from "@/components/shared/logout-button";
import { cn } from "@/lib/utils";
import { useMessagesUnread } from "@/lib/use-messages-unread";

// Sidebar counts/badges are intentionally omitted — the patient slices
// (records, prescriptions, appointments, consents, messages) are not yet
// DB-backed, so showing fake "24" / "3" badges misleads a freshly-signed-in
// user into thinking they have content. Wire counts back in via the relevant
// API once the underlying tables land.
const nav = [
  { href: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patient/records", label: "Medical Records", icon: FileText },
  { href: "/patient/prescriptions", label: "Prescriptions", icon: Pill },
  { href: "/patient/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/documents", label: "Documents", icon: FolderLock },
  { href: "/patient/consents", label: "Consents", icon: Shield },
  { href: "/patient/messages", label: "Messages", icon: MessageSquare },
];

const utility = [
  { href: "/patient/notifications", label: "Notifications", icon: Bell },
  { href: "/patient/settings", label: "Settings", icon: Settings },
];

export function PatientSidebar() {
  const pathname = usePathname();
  const unreadMessages = useMessagesUnread();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]/60 backdrop-blur lg:flex">
      <div className="flex h-16 items-center border-b border-[var(--color-border)] px-5">
        <Link href="/" aria-label="HealthSecure home">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Workspace
        </p>
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
              )}
            >
              {active && (
                <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--color-primary)]" />
              )}
              <Icon className={cn("size-4 shrink-0", active && "text-[var(--color-primary)]")} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/patient/messages" && unreadMessages > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-danger)] px-1.5 text-[10px] font-semibold text-white">
                  {unreadMessages}
                </span>
              )}
            </Link>
          );
        })}

        <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Account
        </p>
        {utility.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--color-border)] p-3">
        {/* <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary-50)] to-[oklch(0.94_0.04_158)] p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-primary-700)]">
            <LifeBuoy className="size-4" />
            Need help?
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
            Your clinic&apos;s support team can assist with records, consent, and scheduling.
          </p>
          <Link
            href="#"
            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary-700)] hover:underline"
          >
            Contact support →
          </Link>
        </div> */}

        <LogoutButton className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]" />
      </div>
    </aside>
  );
}
