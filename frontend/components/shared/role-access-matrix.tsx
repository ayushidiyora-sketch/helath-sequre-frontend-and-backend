import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  UserCircle2,
  Stethoscope,
  Building2,
  ClipboardList,
  Eye,
  ShieldCheck,
  Mail,
  Lock,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const rows = [
  {
    role: "Patient",
    icon: UserCircle2,
    color: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]",
    canLogin: true,
    canRegister: true,
    regNote: "Self OR Invitation",
  },
  {
    role: "Doctor / Clinician",
    icon: Stethoscope,
    color: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]",
    canLogin: true,
    canRegister: false,
    regNote: "Invitation Only",
  },
  {
    role: "Organization Admin",
    icon: Building2,
    color: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]",
    canLogin: true,
    canRegister: false,
    regNote: "Invitation Only",
  },
  {
    role: "Compliance Manager",
    icon: ClipboardList,
    color: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]",
    canLogin: true,
    canRegister: false,
    regNote: "Invitation Only",
  },
  {
    role: "Auditor",
    icon: Eye,
    color: "from-[oklch(0.6_0.06_250)] to-[oklch(0.42_0.04_250)]",
    canLogin: true,
    canRegister: false,
    regNote: "Invitation Only",
  },
  {
    role: "Super Admin",
    icon: ShieldCheck,
    color: "from-[oklch(0.62_0.18_22)] to-[oklch(0.48_0.16_22)]",
    canLogin: true,
    canRegister: false,
    regNote: "Pre-established",
    loginHref: "/super-login",
  },
];

export function RoleAccessMatrix({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]", className)}>
      <div className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-foreground)]">
            Account access by role
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 border-b border-[var(--color-border)] bg-[var(--color-muted)]/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <div className="col-span-6">Role</div>
        <div className="col-span-2 text-center">Login</div>
        <div className="col-span-4">Registration</div>
      </div>

      <ul className="divide-y divide-[var(--color-border)]">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <li key={r.role} className="grid grid-cols-12 items-center gap-3 px-4 py-2.5">
              <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${r.color} text-white`}>
                  <Icon className="size-3.5" />
                </span>
                {r.loginHref ? (
                  <Link
                    href={r.loginHref}
                    className="inline-flex items-center gap-1 truncate text-sm font-medium hover:text-[var(--color-primary-700)] hover:underline"
                  >
                    {r.role} <ArrowUpRight className="size-3" />
                  </Link>
                ) : (
                  <span className="truncate text-sm font-medium">{r.role}</span>
                )}
              </div>
              <div className="col-span-2 flex justify-center">
                {r.canLogin ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[oklch(0.4_0.12_158)] dark:text-[oklch(0.85_0.12_158)]">
                    <CheckCircle2 className="size-3" /> Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-danger-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[oklch(0.4_0.18_22)] dark:text-[oklch(0.85_0.15_22)]">
                    <XCircle className="size-3" /> No
                  </span>
                )}
              </div>
              <div className="col-span-4">
                {r.canRegister ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-success)]">
                    <CheckCircle2 className="size-3" />
                    <span className="font-medium text-[var(--color-foreground)]">{r.regNote}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                    {r.regNote.includes("Pre") ? <Lock className="size-3" /> : <Mail className="size-3" />}
                    {r.regNote}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-[var(--color-border)] bg-[var(--color-muted)]/20 px-4 py-2 text-[10px] text-[var(--color-muted-foreground)]">
        Staff invitations are signed, time-limited tokens delivered via email.
      </div>
    </div>
  );
}
