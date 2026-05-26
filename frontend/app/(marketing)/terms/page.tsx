import { ScrollText } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { LegalDoc, type LegalSection } from "@/components/marketing/legal-doc";

export const metadata = {
  title: "Terms of Service",
  description:
    "The terms governing use of HealthSecure Portal — accounts, acceptable use, PHI handling, and liability.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Acceptance of these terms",
    body: (
      <p>
        By accessing or using HealthSecure Portal (the &ldquo;Service&rdquo;), you
        agree to be bound by these Terms of Service. If you are using the Service
        on behalf of an organization, you represent that you have authority to
        bind that organization. If you do not agree, do not use the Service.
      </p>
    ),
  },
  {
    heading: "Eligibility & accounts",
    body: (
      <>
        <p>
          Accounts are provisioned to patients, clinicians, and administrative
          staff of participating healthcare organizations. You agree to:
        </p>
        <ul>
          <li>Provide accurate registration information and keep it current.</li>
          <li>Protect your credentials and complete multi-factor verification.</li>
          <li>Be responsible for activity that occurs under your account.</li>
          <li>Notify us promptly of any unauthorized use.</li>
        </ul>
        <p>Credentials must never be shared between individuals.</p>
      </>
    ),
  },
  {
    heading: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Access data you are not authorized or consented to view.</li>
          <li>Attempt to bypass permission, consent, or audit controls.</li>
          <li>Probe, scan, or test the security of the Service without authorization.</li>
          <li>Upload malicious code or disrupt the Service&apos;s operation.</li>
          <li>Use the Service to violate any applicable law or regulation.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Protected health information & consent",
    body: (
      <p>
        Use of protected health information within the Service is governed by our{" "}
        <a href="/hipaa">HIPAA Notice</a> and the consent each patient grants.
        Clinical users agree to access PHI only with a valid, in-scope consent and
        a legitimate treatment purpose. All access is audit-logged.
      </p>
    ),
  },
  {
    heading: "Intellectual property",
    body: (
      <p>
        The Service, including its software, design, and content, is owned by
        Sensussoft Software Pvt Ltd and its licensors and is protected by
        intellectual-property laws. You receive a limited, non-exclusive,
        non-transferable right to use the Service for its intended purpose. Health
        records remain the property and responsibility of the relevant covered
        entity and patient.
      </p>
    ),
  },
  {
    heading: "Service availability & changes",
    body: (
      <p>
        We work to keep the Service available and secure, but it is provided on an
        &ldquo;as available&rdquo; basis. We may modify, suspend, or discontinue
        features, and may perform maintenance that briefly interrupts access. We
        will give reasonable notice of material changes where practical.
      </p>
    ),
  },
  {
    heading: "Disclaimers & limitation of liability",
    body: (
      <>
        <p>
          The Service is not a substitute for professional medical judgment or
          emergency care. To the maximum extent permitted by law, the Service is
          provided <strong>&ldquo;as is&rdquo;</strong> without warranties of any
          kind.
        </p>
        <p>
          To the extent permitted by law, Sensussoft Software Pvt Ltd is not liable
          for indirect, incidental, or consequential damages arising from use of
          the Service.
        </p>
      </>
    ),
  },
  {
    heading: "Termination",
    body: (
      <p>
        We or your organization may suspend or terminate access if these terms are
        breached or if required for security or legal reasons. On termination, your
        right to use the Service ends; audit records and health data are retained
        as required by law and your organization&apos;s policies.
      </p>
    ),
  },
  {
    heading: "Governing law & contact",
    body: (
      <p>
        These terms are governed by the laws of the jurisdiction in which
        Sensussoft Software Pvt Ltd is established, without regard to conflict-of-law
        rules. Questions about these terms can be sent via our{" "}
        <a href="/contact">contact page</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        icon={ScrollText}
        image="/bg-terms.jpg"
        title={
          <>
            Terms of{" "}
            <span className="bg-gradient-to-r from-[var(--color-primary)] to-[oklch(0.52_0.14_240)] bg-clip-text text-transparent">
              Service
            </span>
          </>
        }
        description="The agreement that governs how you may access and use HealthSecure Portal."
        meta="Last updated · May 20, 2026"
      />
      <LegalDoc
        intro={
          <p>
            Please read these terms carefully. They form a binding agreement
            between you (and any organization you represent) and Sensussoft
            Software Pvt Ltd regarding your use of HealthSecure Portal.
          </p>
        }
        sections={SECTIONS}
      />
    </>
  );
}
