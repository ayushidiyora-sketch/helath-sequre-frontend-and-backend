import Link from "next/link";
import {
  ArrowRight,
  Check,
  Minus,
  Sparkles,
  ShieldCheck,
  Building2,
  Stethoscope,
  Wallet,
  Phone,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "@/components/marketing/page-hero";
import { getTiers } from "@/lib/tiers";

export const metadata = {
  title: "Pricing",
  description:
    "Transparent pricing for HealthSecure Portal. Pick a tier per the size of your practice — every plan includes end-to-end encryption, append-only audit, and a signed HIPAA BAA.",
};

// Tiers are DB-backed (edited from Super Admin → Configuration → Tiers), so the
// pricing always reflects the latest config.
export const dynamic = "force-dynamic";

interface Tier {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  monthly: number | null;
  annualMonthly: number | null;
  unit: string;
  ctaLabel: string;
  ctaHref: string;
  featured: boolean;
  bullets: string[];
}

const TIER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  solo: Stethoscope,
  hospital: Building2,
  enterprise: ShieldCheck,
};

interface FeatureRow {
  label: string;
  solo: boolean | string;
  hospital: boolean | string;
  enterprise: boolean | string;
}

const COMPARISON: { group: string; rows: FeatureRow[] }[] = [
  {
    group: "Core platform",
    rows: [
      { label: "Encrypted medical records", solo: true, hospital: true, enterprise: true },
      { label: "Appointment scheduling", solo: true, hospital: true, enterprise: true },
      { label: "Secure messaging", solo: true, hospital: true, enterprise: true },
      { label: "Document vault", solo: true, hospital: true, enterprise: true },
      { label: "Granular consent management", solo: true, hospital: true, enterprise: true },
    ],
  },
  {
    group: "Compliance & audit",
    rows: [
      { label: "Append-only audit ledger", solo: "1 year", hospital: "6 years", enterprise: "Lifetime" },
      { label: "Anomaly detection engine", solo: false, hospital: true, enterprise: true },
      { label: "Re-consent campaigns", solo: false, hospital: true, enterprise: true },
      { label: "Approval workflows", solo: false, hospital: true, enterprise: true },
      { label: "GDPR right-to-be-forgotten matrix", solo: false, hospital: true, enterprise: true },
      { label: "Break-glass emergency access", solo: false, hospital: true, enterprise: true },
    ],
  },
  {
    group: "Identity & access",
    rows: [
      { label: "MFA · email OTP", solo: true, hospital: true, enterprise: true },
      { label: "Single sign-on (SAML / OIDC)", solo: false, hospital: true, enterprise: true },
      { label: "Role-based access control (6 roles)", solo: true, hospital: true, enterprise: true },
      { label: "IP allowlist · device binding", solo: false, hospital: true, enterprise: true },
    ],
  },
  {
    group: "Security posture",
    rows: [
      { label: "TLS 1.3 · AES-256 at rest", solo: true, hospital: true, enterprise: true },
      { label: "Customer-managed keys (BYOK)", solo: false, hospital: false, enterprise: true },
      { label: "On-prem / sovereign cloud", solo: false, hospital: false, enterprise: true },
      { label: "Pen-test on request", solo: false, hospital: false, enterprise: true },
    ],
  },
  {
    group: "Support",
    rows: [
      { label: "Email support", solo: "1 business day", hospital: "4 hours", enterprise: "1 hour" },
      { label: "Dedicated CSM", solo: false, hospital: true, enterprise: true },
      { label: "Named TAM + 24×7 paging", solo: false, hospital: false, enterprise: true },
      { label: "Signed HIPAA BAA", solo: true, hospital: true, enterprise: true },
    ],
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do you sign a HIPAA Business Associate Agreement (BAA)?",
    a: "Yes — every plan includes a signed BAA. The Enterprise tier additionally supports custom DPA terms and sub-processor approval gates.",
  },
  {
    q: "Are taxes included in the listed price?",
    a: "Prices are exclusive of GST / VAT and any applicable local sales tax. Tax is added at checkout based on your billing address.",
  },
  {
    q: "Can I switch tiers later?",
    a: "Yes. You can upgrade at any time with prorated billing. Downgrades take effect at the end of the current billing period, and your audit retention is preserved across changes.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "You get a 30-day grace window to export everything as PDF, CSV, or HL7 FHIR JSON. After that, data is purged according to the retention policy you had configured, with audit-log destruction certificates issued on request.",
  },
  {
    q: "How is an \"active patient record\" counted on the Hospital tier?",
    a: "A record is active if any clinical access or consent event occurred within the past 90 days. Dormant records are free and remain searchable.",
  },
  {
    q: "Do you offer non-profit or research pricing?",
    a: "Yes — verified non-profit health initiatives, academic medical centers, and approved research projects receive 30% off the Hospital tier. Contact sales for verification.",
  },
];

export default async function PricingPage() {
  const tiers: Tier[] = (await getTiers()).map((t) => ({
    ...t,
    icon: TIER_ICONS[t.icon] ?? Stethoscope,
  }));
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        icon={Wallet}
        image="/bg-services.jpg"
        title={
          <>
            Transparent pricing.{" "}
            <span className="bg-gradient-to-r from-[var(--color-primary)] to-[oklch(0.52_0.14_240)] bg-clip-text text-transparent">
              No PHI markup.
            </span>
          </>
        }
        description="Three tiers — pick the one closest to your practice and switch as you grow. Every plan ships with a signed HIPAA BAA, end-to-end encryption, and an append-only audit ledger."
        highlights={["Annual billing · 17% off", "Signed BAA on every plan", "No setup fees"]}
      />

      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="grid gap-5 lg:grid-cols-3">
          {tiers.map((t) => <TierCard key={t.id} t={t} />)}
        </div>
        <p className="mt-6 text-center text-xs text-[var(--color-muted-foreground)]">
          Prices in USD · billed monthly unless annual is selected · GST / VAT exclusive
        </p>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[var(--color-card)]/40">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
            Side-by-side
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            What&apos;s in each plan
          </h2>
          <p className="mt-2 max-w-2xl text-[var(--color-muted-foreground)]">
            The full feature matrix. Most teams outgrow Solo within their first compliance audit — Hospital is where the heavy compliance machinery lives.
          </p>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Capability</th>
                  {tiers.map((t) => (
                    <th key={t.id} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      <span className="flex items-center gap-2">
                        {t.name}
                        {t.featured && <Badge variant="info" size="sm" dot>Most popular</Badge>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((g) => (
                  <FeatureGroup key={g.group} group={g} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[oklch(0.96_0.025_200)] p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_200)] to-transparent opacity-25 blur-3xl" />
          <Quote className="size-8 text-[var(--color-primary)]/40" />
          <p className="relative mt-3 max-w-3xl text-xl leading-relaxed sm:text-2xl">
            &ldquo;We were paying for two separate vendors — one for records, one for consent. HealthSecure replaced both and our HIPAA audit prep time dropped from six weeks to four days.&rdquo;
          </p>
          <div className="relative mt-6 flex items-center gap-3 text-sm">
            <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-sm font-semibold text-white shadow-sm">
              AD
            </span>
            <div>
              <p className="font-semibold">Anjali Desai</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">Compliance Manager · City General Hospital</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--color-border)] bg-[var(--color-card)]/40">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
            Frequently asked
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Pricing & billing questions
          </h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-colors open:border-[var(--color-primary)]/40"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 list-none [&::-webkit-details-marker]:hidden">
                  <span className="font-semibold">{item.q}</span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] transition-transform group-open:rotate-45">
                    <Sparkles className="size-3.5 text-[var(--color-primary-700)]" />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[oklch(0.96_0.025_200)] via-[var(--color-card)] to-[oklch(0.96_0.025_158)] p-10 text-center sm:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_200)] to-transparent opacity-30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_158)] to-transparent opacity-30 blur-3xl" />
          <h2 className="relative text-2xl font-semibold tracking-tight sm:text-3xl">
            Not sure which tier fits?
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-[var(--color-muted-foreground)]">
            Tell us about your practice and we&apos;ll recommend a plan — usually in the same business day.
          </p>
          <div className="relative mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/contact">
                <Phone /> Talk to sales <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/register">Start free trial</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function TierCard({ t }: { t: Tier }) {
  const Icon = t.icon;
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-7 transition-all duration-200 ${
        t.featured
          ? "border-[var(--color-primary)]/50 bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[oklch(0.96_0.025_200)] shadow-[var(--shadow-lift)] lg:-translate-y-2"
          : "border-[var(--color-border)] bg-[var(--color-card)] hover:-translate-y-1 hover:border-[var(--color-primary)]/40"
      }`}
    >
      {t.featured && (
        <span className="absolute right-5 top-5">
          <Badge variant="info" size="sm" dot>Most popular</Badge>
        </span>
      )}
      <span
        className={`flex size-11 items-center justify-center rounded-xl shadow-sm ${
          t.featured
            ? "bg-gradient-to-br from-[var(--color-primary)] to-[oklch(0.5_0.12_215)] text-white"
            : "bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white"
        }`}
      >
        <Icon className="size-5" />
      </span>
      <h3 className="mt-5 text-lg font-semibold">{t.name}</h3>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t.tagline}</p>

      <div className="mt-6">
        {t.monthly !== null ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tracking-tight">${t.monthly}</span>
              <span className="text-sm text-[var(--color-muted-foreground)]">/ month</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {t.unit}
              {t.annualMonthly && (
                <>
                  {" · "}
                  <span className="font-medium text-[var(--color-primary-700)]">
                    ${t.annualMonthly}/mo annually
                  </span>
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <div className="text-3xl font-semibold tracking-tight">Custom</div>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{t.unit}</p>
          </>
        )}
      </div>

      <Button asChild size="lg" variant={t.featured ? "default" : "outline"} className="mt-6 w-full">
        <Link href={t.ctaHref}>
          {t.ctaLabel} <ArrowRight />
        </Link>
      </Button>

      <ul className="mt-6 space-y-2.5 text-sm">
        {t.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-primary-700)]" />
            <span className="text-[var(--color-muted-foreground)]">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureGroup({ group }: { group: { group: string; rows: FeatureRow[] } }) {
  return (
    <>
      <tr className="bg-[var(--color-muted)]/20">
        <td colSpan={4} className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
          {group.group}
        </td>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.label} className="border-t border-[var(--color-border)]">
          <td className="px-5 py-3 text-sm">{r.label}</td>
          <Cell value={r.solo} />
          <Cell value={r.hospital} />
          <Cell value={r.enterprise} />
        </tr>
      ))}
    </>
  );
}

function Cell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <td className="px-5 py-3">
        <Check className="size-4 text-[var(--color-primary-700)]" />
      </td>
    );
  }
  if (value === false) {
    return (
      <td className="px-5 py-3">
        <Minus className="size-4 text-[var(--color-muted-foreground)]/60" />
      </td>
    );
  }
  return (
    <td className="px-5 py-3 text-xs font-medium text-[var(--color-foreground)]">{value}</td>
  );
}
