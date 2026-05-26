import Link from "next/link";
import {
  ArrowRight,
  FileLock2,
  CalendarClock,
  HeartHandshake,
  ScrollText,
  MessageSquare,
  KeyRound,
  ClipboardCheck,
  FolderLock,
  Flame,
  Building2,
  Activity,
  ShieldCheck,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata = {
  title: "Services & Features",
  description:
    "Encrypted medical records, consent management, append-only audit, RBAC, MFA, and compliance reporting — the full HealthSecure Portal feature set.",
};

const FEATURES = [
  {
    icon: FileLock2,
    title: "Encrypted medical records",
    body: "Lab results, imaging, diagnoses, and clinical notes stored with encryption at rest. Every read is consent-evaluated and written to the audit ledger.",
  },
  {
    icon: CalendarClock,
    title: "Appointment scheduling",
    body: "Patients book against real clinician availability; staff reschedule and cancel with reason capture. Reminders go out automatically.",
  },
  {
    icon: HeartHandshake,
    title: "Granular consent management",
    body: "Patients grant access scoped by PHI category, clinician, and duration — and revoke any time. Revocation takes effect on the next API call.",
  },
  {
    icon: ScrollText,
    title: "Append-only audit trail",
    body: "Every access, grant, export, and login lands in a tamper-evident ledger with rolling checksums — filterable by actor, action, resource, and time.",
  },
  {
    icon: MessageSquare,
    title: "Secure messaging",
    body: "Threaded, encrypted communication between patients and their care team, kept inside the portal's audited boundary — no PHI over email.",
  },
  {
    icon: KeyRound,
    title: "MFA & email OTP sign-in",
    body: "Two-step login: password plus a one-time code delivered by email. Account lockout after repeated failures blunts credential-stuffing.",
  },
  {
    icon: ClipboardCheck,
    title: "Compliance reporting",
    body: "Generate access reports, consent-compliance summaries, and audit exports as PDF or CSV — each with metadata and verification checksums.",
  },
  {
    icon: FolderLock,
    title: "Document vault",
    body: "Upload and share clinical documents with consent-evaluated downloads, so files are governed by exactly the same rules as records.",
  },
  {
    icon: Flame,
    title: "Break-glass emergency access",
    body: "Time-boxed, heavily audited PHI access for genuine emergencies — every break-glass session is flagged for compliance review.",
  },
  {
    icon: Building2,
    title: "Multi-tenant isolation",
    body: "Each clinic, hospital, or telemedicine provider is a separate tenant. An organization discriminator scopes every query — no cross-tenant leakage.",
  },
  {
    icon: Activity,
    title: "Anomaly detection",
    body: "Unusual patterns — bulk downloads, off-hours access, repeated denials — are surfaced to compliance managers for fast triage.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access control",
    body: "Six least-privileged roles, each with a precise permission set. No role can reach beyond its mandate, and the matrix is enforced server-side.",
  },
];

const ROLES = [
  { name: "Patient", desc: "Owns records, consent, appointments, and messages." },
  { name: "Clinician", desc: "Consent-bound access to assigned patients' PHI." },
  { name: "Org Admin", desc: "Manages users, clinicians, and departments." },
  { name: "Compliance Manager", desc: "Owns consent policy, anomalies, and reports." },
  { name: "Auditor", desc: "Read-only audit and consent visibility." },
  { name: "Super Admin", desc: "Platform operations — never tenant PHI." },
];

const ICON_TILE =
  "flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white shadow-sm";

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services & features"
        icon={LayoutGrid}
        image="/bg-services.jpg"
        title={
          <>
            Everything a HIPAA-ready portal needs —{" "}
            <span className="bg-gradient-to-r from-[var(--color-primary)] to-[oklch(0.52_0.14_240)] bg-clip-text text-transparent">
              and nothing it shouldn&apos;t
            </span>
          </>
        }
        description="HealthSecure Portal pairs the everyday tools patients and clinicians expect with the security controls a compliance team can stand behind."
        highlights={["12 platform capabilities", "6 tailored roles", "Server-enforced"]}
      />

      {/* Feature grid */}
      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
          Platform capabilities
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Twelve building blocks of a secure portal
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-lift)]"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 size-24 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_200)] to-transparent opacity-0 blur-2xl transition-opacity duration-200 group-hover:opacity-30" />
                <span className={`${ICON_TILE} transition-transform group-hover:scale-105`}>
                  <Icon className="size-5" />
                </span>
                <h3 className="relative mt-4 font-semibold">{f.title}</h3>
                <p className="relative mt-1.5 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Roles */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-card)]/40">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
            Role-tailored experiences
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            One portal, six tailored experiences
          </h2>
          <p className="mt-2 max-w-2xl text-[var(--color-muted-foreground)]">
            Each role is constrained to exactly what it is permitted to do — the
            access matrix is enforced on the server, not just hidden in the UI.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r, i) => (
              <div
                key={r.name}
                className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-xs font-semibold text-white shadow-sm">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold">{r.name}</h3>
                </div>
                <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[oklch(0.96_0.025_200)] via-[var(--color-card)] to-[oklch(0.96_0.025_158)] p-10 text-center sm:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_200)] to-transparent opacity-30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_158)] to-transparent opacity-30 blur-3xl" />
          <h2 className="relative text-2xl font-semibold tracking-tight sm:text-3xl">
            See the platform from the inside
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-[var(--color-muted-foreground)]">
            Create a patient account in minutes, or talk to us about onboarding
            your organization.
          </p>
          <div className="relative mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Create patient account <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">Contact sales</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
