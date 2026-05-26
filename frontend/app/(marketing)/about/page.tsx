import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  HeartHandshake,
  Lock,
  Eye,
  Users,
  Building2,
  Sparkles,
  User,
  Stethoscope,
  ClipboardCheck,
  FileSearch,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata = {
  title: "About Us",
  description:
    "HealthSecure Portal is a compliance-first patient portal built by Sensussoft — protecting protected health information with zero-trust access and append-only audit.",
};

const STATS = [
  { value: "6", label: "Distinct roles, each least-privileged" },
  { value: "23", label: "Audited data domains" },
  { value: "100%", label: "PHI access consent-evaluated" },
  { value: "0", label: "Shared credentials, ever" },
];

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Compliance is the architecture",
    body: "HIPAA, GDPR, and HL7/FHIR alignment are not bolt-ons. Consent checks, encryption, and audit logging are wired into every data path from day one.",
  },
  {
    icon: Lock,
    title: "Zero-trust by default",
    body: "No role sees protected health information unless an explicit, time-bound permission and an active consent both allow it — evaluated on every request.",
  },
  {
    icon: Eye,
    title: "Everything is observable",
    body: "Every PHI access, grant, and revocation lands in an append-only ledger with rolling checksums, so auditors can reconstruct exactly what happened.",
  },
  {
    icon: HeartHandshake,
    title: "Patients hold the keys",
    body: "Consent is a first-class object. Patients grant, scope, and revoke access to their own records — and revocation takes effect on the next API call.",
  },
];

const ROLES = [
  { icon: User, name: "Patients", body: "Own their records and control every consent." },
  { icon: Stethoscope, name: "Clinicians", body: "Treat assigned patients with consent-bound access." },
  { icon: Building2, name: "Organization admins", body: "Provision staff and configure the clinic." },
  { icon: ClipboardCheck, name: "Compliance managers", body: "Own consent policy and audit response." },
  { icon: FileSearch, name: "Auditors", body: "Read-only visibility into every access event." },
  { icon: Server, name: "Platform operators", body: "Run the platform — never tenant PHI." },
];

const ICON_TILE =
  "flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white shadow-sm";

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        icon={Sparkles}
        image="/bg-about.jpg"
        title={
          <>
            Healthcare software where trust is{" "}
            <span className="bg-gradient-to-r from-[oklch(0.8_0.13_195)] to-[oklch(0.7_0.14_230)] bg-clip-text text-transparent">
              provable
            </span>
            , not promised
          </>
        }
        description="HealthSecure Portal exists to make protected health information safe to share — between patients, clinicians, and the people who keep them accountable."
        highlights={["HIPAA-ready", "Zero-trust", "Append-only audit"]}
      />

      {/* Mission + stats */}
      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
              Our mission
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Make sensitive health data safe to share
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[var(--color-foreground)]">
              Most patient portals treat security as a feature to be added
              later. We built HealthSecure Portal on the opposite premise.
            </p>
            <div className="mt-4 space-y-4 leading-relaxed text-[var(--color-muted-foreground)]">
              <p>
                A portal handling protected health information (PHI) should be
                unable to leak it by design — not by policy, and not by the
                discipline of whoever happens to be on call.
              </p>
              <p>
                That means a permission model checked on every request, a
                consent system the patient genuinely controls, encryption for
                data at rest and in transit, and an audit trail that no one —
                not even a platform operator — can quietly edit. The result is a
                portal where compliance is something you can demonstrate, not
                just assert.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-b from-[var(--color-card)] to-[var(--color-primary-50)]/30 p-6"
              >
                <p className="bg-gradient-to-br from-[var(--color-primary)] to-[oklch(0.5_0.14_180)] bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
                  {s.value}
                </p>
                <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-card)]/40">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
            What we stand for
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Four principles, enforced in code
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            These are not slogans. Each one maps to a control that runs on every
            request that touches protected health information.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {VALUES.map((v, i) => {
              const Icon = v.icon;
              return (
                <div
                  key={v.title}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-lift)]"
                >
                  <span className="pointer-events-none absolute right-4 top-3 font-mono text-5xl font-semibold text-[var(--color-primary)]/[0.07]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={`${ICON_TILE} transition-transform group-hover:scale-105`}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{v.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                    {v.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
          Who it&apos;s for
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Built for everyone in the care loop
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Six roles, each with its own portal and its own least-privileged view
          of the same carefully governed data.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.name}
                className="flex items-start gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-colors hover:border-[var(--color-primary)]/40"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{r.name}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                    {r.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Company + CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-20 sm:pb-24">
        <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary-50)] via-[var(--color-card)] to-[var(--color-card)] p-8 sm:p-12">
          <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white shadow-sm">
                <Building2 className="size-6" />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Built by Sensussoft Software Pvt Ltd
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                  HealthSecure Portal is a compliance-engineering showcase
                  product. Tenants remain responsible for their own operational
                  compliance posture; we provide the secure foundation it stands
                  on.
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/contact">
                  <Users /> Talk to our team
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/services">
                  Explore the platform <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
