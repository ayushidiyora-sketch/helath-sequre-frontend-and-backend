import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { SecurityBadge } from "@/components/shared/security-badge";

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Services & features", href: "/services" },
      { label: "Patient sign-up", href: "/register" },
      { label: "Clinician sign-in", href: "/staff-login" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Contact us", href: "/contact" },
      { label: "Platform operations", href: "/super-login" },
    ],
  },
  {
    title: "Legal & trust",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "HIPAA notice", href: "/hipaa" },
    ],
  },
];

/** Shared public-site footer — used by the landing page and marketing pages. */
export function SiteFooter() {
  return (
    <footer className="relative  mesh-bg border-t border-[var(--color-border)] bg-[var(--color-card)]/40 backdrop-blur">
      {/* Gradient hairline accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/50 to-transparent" />
      {/* Soft glow behind the brand column */}
      {/* <div className="pointer-events-none absolute -bottom-20 left-0 size-72 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_200)] to-transparent opacity-10 blur-3xl" /> */}

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              A compliance-first patient portal for clinics, hospitals, and
              telemedicine providers — zero-trust permissions, append-only
              audit, and granular consent capture.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <SecurityBadge variant="encrypted" />
              <SecurityBadge variant="audited" />
              <SecurityBadge variant="consent-bound" />
            </div>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/70 px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-success)]" />
              </span>
              All systems operational
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground)]">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
                    >
                      {link.label}
                      <ArrowRight className="size-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-3 border-t border-[var(--color-border)]/70 py-6 text-xs text-[var(--color-muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Sensussoft Software Pvt Ltd · Compliance-engineering showcase</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-[var(--color-primary)]" />
              HIPAA · GDPR · HL7/FHIR-ready
            </span>
            <span className="hidden text-[var(--color-border)] sm:inline">·</span>
            <span>Data residency: in-region</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
