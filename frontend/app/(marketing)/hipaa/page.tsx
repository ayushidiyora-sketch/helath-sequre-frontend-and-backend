import {
  ShieldCheck,
  Lock,
  ScrollText,
  HeartHandshake,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { LegalDoc, type LegalSection } from "@/components/marketing/legal-doc";

const PILLARS = [
  {
    icon: Lock,
    title: "Encryption everywhere",
    body: "PHI is encrypted at rest and in transit; the most sensitive fields carry an extra application-level layer.",
  },
  {
    icon: ShieldCheck,
    title: "Least-privilege access",
    body: "Role-based permissions are enforced on the server — never just hidden in the UI — and checked on every request.",
  },
  {
    icon: ScrollText,
    title: "Append-only audit",
    body: "Every access, grant, and export lands in a tamper-evident ledger with rolling integrity checksums.",
  },
  {
    icon: HeartHandshake,
    title: "Patient-controlled consent",
    body: "Patients grant and revoke access themselves; revocation takes effect on the very next request.",
  },
  {
    icon: AlertTriangle,
    title: "Breach notification",
    body: "If unsecured PHI is exposed, affected individuals are notified promptly per the HIPAA Breach Notification Rule.",
  },
  {
    icon: UserCheck,
    title: "Your rights, honored",
    body: "Access, amend, restrict, and receive an accounting of every disclosure of your health information.",
  },
];

export const metadata = {
  title: "HIPAA Notice & Compliance",
  description:
    "How HealthSecure Portal protects protected health information (PHI), the rights patients hold, and the safeguards in place.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Our commitment to your health information",
    body: (
      <>
        <p>
          HealthSecure Portal handles <strong>protected health information (PHI)</strong>{" "}
          on behalf of healthcare organizations (&ldquo;covered entities&rdquo;).
          We are committed to keeping that information private and secure, and to
          processing it only as permitted by the U.S. Health Insurance
          Portability and Accountability Act (HIPAA) and applicable regulations.
        </p>
        <p>
          This notice describes how health information about you may be used and
          disclosed within the portal, and how you can access that information.
        </p>
      </>
    ),
  },
  {
    heading: "How PHI may be used and disclosed",
    body: (
      <>
        <p>Within the portal, your health information may be used for:</p>
        <ul>
          <li>
            <strong>Treatment</strong> — clinicians assigned to your care, and to
            whom you have granted consent, may view records needed to treat you.
          </li>
          <li>
            <strong>Healthcare operations</strong> — your organization may use
            de-identified or minimum-necessary data to run and improve services.
          </li>
          <li>
            <strong>As required by law</strong> — disclosures to regulators or
            authorities where a legal obligation applies.
          </li>
        </ul>
        <p>
          Every access is evaluated against your active consent and the
          requesting role&apos;s permissions, and is written to an audit ledger.
        </p>
      </>
    ),
  },
  {
    heading: "Your rights regarding your PHI",
    body: (
      <>
        <p>You have the right to:</p>
        <ul>
          <li>Access and obtain a copy of the health information held about you.</li>
          <li>Request a correction or amendment to information you believe is wrong.</li>
          <li>Receive an accounting of who has accessed your records.</li>
          <li>Grant, scope, and revoke consent for specific clinicians and data categories.</li>
          <li>Request restrictions on certain uses and disclosures.</li>
          <li>Be notified in the event of a breach affecting your information.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Consent and authorization",
    body: (
      <p>
        Consent is a first-class control in HealthSecure Portal. Clinician access
        to your PHI requires an <strong>active, in-scope consent</strong> that you
        grant. You may revoke consent at any time; revocation takes effect on the
        next request and is itself recorded in the audit trail. Uses beyond
        treatment, payment, and operations require your explicit authorization.
      </p>
    ),
  },
  {
    heading: "Safeguards we apply",
    body: (
      <>
        <p>The platform enforces administrative, physical, and technical safeguards:</p>
        <ul>
          <li>Encryption of PHI in transit and at rest.</li>
          <li>Role-based access control with least-privilege permissions.</li>
          <li>Multi-factor authentication and account lockout on the sign-in path.</li>
          <li>An append-only audit ledger with rolling integrity checksums.</li>
          <li>Multi-tenant isolation so organizations cannot reach each other&apos;s data.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Minimum necessary & business associates",
    body: (
      <p>
        We apply the <strong>minimum-necessary</strong> principle: a role receives
        only the data required for its function. Where subcontractors process PHI
        on our behalf, they are bound by Business Associate Agreements that carry
        equivalent obligations.
      </p>
    ),
  },
  {
    heading: "Breach notification",
    body: (
      <p>
        If a breach of unsecured PHI is discovered, affected individuals and the
        relevant covered entity are notified without unreasonable delay, in line
        with the HIPAA Breach Notification Rule. Audit records support rapid,
        accurate scoping of any incident.
      </p>
    ),
  },
  {
    heading: "Changes to this notice & complaints",
    body: (
      <p>
        We may update this notice as practices or regulations change; the current
        version is always posted here. If you believe your privacy rights have
        been violated, you may raise a complaint with your healthcare organization
        or contact us at <a href="/contact">our contact page</a>. You will not be
        penalized for filing a complaint.
      </p>
    ),
  },
];

export default function HipaaPage() {
  return (
    <>
      <PageHero
        eyebrow="Compliance"
        icon={ShieldCheck}
        image="/hero-health.jpg"
        title={
          <>
            HIPAA Notice of{" "}
            <span className="bg-gradient-to-r from-[var(--color-primary)] to-[oklch(0.52_0.14_240)] bg-clip-text text-transparent">
              Privacy Practices
            </span>
          </>
        }
        description="How protected health information is used, disclosed, and safeguarded within HealthSecure Portal — and the rights you hold over it."
        meta="Last updated · May 20, 2026"
      />

      {/* Compliance pillars — visual summary above the legal text */}
      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
          Compliance at a glance
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Six pillars behind every PHI interaction
        </h2>
        <p className="mt-2 max-w-2xl text-[var(--color-muted-foreground)]">
          The full notice is below — here is the short version of how
          HealthSecure Portal keeps protected health information safe.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-lift)]"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white shadow-sm transition-transform group-hover:scale-105">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                  {p.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="border-t border-[var(--color-border)] bg-[var(--color-card)]/40">
        <div className="mx-auto max-w-7xl px-6 pt-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Full HIPAA notice
          </h2>
          <p className="mt-2 text-[var(--color-muted-foreground)]">
            The complete plain-language notice — eight sections.
          </p>
        </div>
      </div>

      <div className="bg-[var(--color-card)]/40">
        <LegalDoc
        intro={
          <p>
            This notice is a plain-language summary of how HealthSecure Portal
            handles PHI. It supplements — and does not replace — the Notice of
            Privacy Practices issued by your own healthcare provider.
          </p>
        }
        sections={SECTIONS}
        />
      </div>
    </>
  );
}
