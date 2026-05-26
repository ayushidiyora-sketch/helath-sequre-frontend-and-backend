import { Lock } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { LegalDoc, type LegalSection } from "@/components/marketing/legal-doc";

export const metadata = {
  title: "Privacy Policy",
  description:
    "What data HealthSecure Portal collects, how it is used and protected, and the privacy rights you can exercise.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Scope of this policy",
    body: (
      <p>
        This Privacy Policy explains how HealthSecure Portal collects, uses, and
        protects information when you use the Service. Protected health
        information (PHI) is additionally governed by our{" "}
        <a href="/hipaa">HIPAA Notice</a>. Where your healthcare organization is
        the data controller, its own privacy notice also applies.
      </p>
    ),
  },
  {
    heading: "Information we collect",
    body: (
      <>
        <ul>
          <li>
            <strong>Account data</strong> — name, email address, role, and
            organization, plus authentication data such as hashed passwords.
          </li>
          <li>
            <strong>Health information</strong> — records, appointments, consents,
            documents, and messages created within the portal.
          </li>
          <li>
            <strong>Usage &amp; security data</strong> — sign-in events, IP
            address, device/browser details, and audit-log entries.
          </li>
        </ul>
        <p>We do not sell personal information.</p>
      </>
    ),
  },
  {
    heading: "How we use information",
    body: (
      <>
        <p>Information is used to:</p>
        <ul>
          <li>Provide, secure, and operate the Service.</li>
          <li>Authenticate users and deliver one-time verification codes.</li>
          <li>Enforce permissions and consent on every PHI access.</li>
          <li>Maintain audit trails and detect anomalous activity.</li>
          <li>Communicate service, security, and account notifications.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Legal bases & consent",
    body: (
      <p>
        We process data to perform our agreement with you, to meet legal
        obligations, for legitimate security interests, and — for PHI access — on
        the basis of the consent each patient grants. Patients control consent
        directly and may revoke it at any time.
      </p>
    ),
  },
  {
    heading: "How we share information",
    body: (
      <>
        <p>Information is shared only:</p>
        <ul>
          <li>With your healthcare organization and consented clinicians.</li>
          <li>With service providers bound by confidentiality and data-protection terms.</li>
          <li>Where required by law or to protect rights, safety, and security.</li>
        </ul>
        <p>Organizations are isolated as separate tenants; data is never shared across tenants.</p>
      </>
    ),
  },
  {
    heading: "Data security",
    body: (
      <p>
        We apply encryption in transit and at rest, role-based access control,
        multi-factor authentication, account lockout, and append-only audit
        logging. No system is perfectly secure, but security is engineered into
        the platform&apos;s architecture rather than added afterwards.
      </p>
    ),
  },
  {
    heading: "Data retention",
    body: (
      <p>
        Health records and audit logs are retained for the periods required by law
        and by your healthcare organization&apos;s policies. Account data is kept
        while your account is active and for a reasonable period afterwards.
        Transient data such as one-time codes expires within minutes.
      </p>
    ),
  },
  {
    heading: "Your privacy rights",
    body: (
      <>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion, subject to legal retention requirements.</li>
          <li>Object to or restrict certain processing.</li>
          <li>Receive an accounting of disclosures of your health information.</li>
        </ul>
        <p>
          Requests can be made through your organization or via our{" "}
          <a href="/contact">contact page</a>.
        </p>
      </>
    ),
  },
  {
    heading: "Cookies & tracking",
    body: (
      <p>
        HealthSecure Portal uses only the cookies necessary to operate — chiefly a
        secure, HTTP-only session cookie that keeps you signed in. We do not use
        advertising or third-party tracking cookies.
      </p>
    ),
  },
  {
    heading: "Changes & contact",
    body: (
      <p>
        We may update this policy as the Service or applicable law evolves; the
        current version is always posted here with its effective date. For any
        privacy question, reach us through our <a href="/contact">contact page</a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        icon={Lock}
        image="/bg-privacy.jpg"
        title={
          <>
            Privacy{" "}
            <span className="bg-gradient-to-r from-[var(--color-primary)] to-[oklch(0.52_0.14_240)] bg-clip-text text-transparent">
              Policy
            </span>
          </>
        }
        description="What we collect, why we collect it, how we protect it, and the choices you have."
        meta="Last updated · May 20, 2026"
      />
      <LegalDoc
        intro={
          <p>
            We keep this policy deliberately plain. It covers personal data handled
            by HealthSecure Portal; protected health information additionally
            follows our HIPAA Notice.
          </p>
        }
        sections={SECTIONS}
      />
    </>
  );
}
