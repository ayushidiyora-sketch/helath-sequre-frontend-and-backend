/**
 * Mock consent-policy versions — shared by the list, view, and edit pages.
 * Frontend-only demo data; no backend.
 */

export interface PolicySection {
  heading: string;
  body: string;
}

export interface PolicyVersion {
  version: string; // "v2.4"
  slug: string; // route param, "v2-4"
  status: "active" | "archived" | "draft";
  period: string;
  summary: string;
  adoption: number;
  consents: number;
  scopeCategories: number;
  roleBindings: number;
  sections: PolicySection[];
  history: { date: string; event: string }[];
}

const PURPOSE =
  "This consent policy governs how Protected Health Information (PHI) is accessed, shared, and processed within HealthSecure Portal. By granting consent, the patient authorizes the named clinical and administrative roles to access only the record categories explicitly listed below, for the stated purpose of care delivery.";

export const POLICIES: PolicyVersion[] = [
  {
    version: "v2.4",
    slug: "v2-4",
    status: "active",
    period: "Activated May 1, 2026",
    summary: "Adds data-portability notice and clarifies the audit retention window.",
    adoption: 94,
    consents: 1284,
    scopeCategories: 7,
    roleBindings: 3,
    sections: [
      { heading: "Purpose & scope", body: PURPOSE },
      {
        heading: "PHI categories covered",
        body: "Consent applies to seven record categories: lab reports, prescriptions, diagnostic imaging, clinical notes, discharge summaries, insurance documents, and uploaded patient records. Access is bound to the patient's assigned clinician and care team only.",
      },
      {
        heading: "Retention & data portability",
        body: "Medical records are retained for a minimum of seven years in line with HIPAA. Patients may request a portable export of their PHI in PDF or CSV format at any time, supporting the HIPAA right-of-access. Audit logs are retained for a minimum of six years.",
      },
      {
        heading: "Re-consent & revocation",
        body: "Consent may be revoked by the patient at any time, taking effect immediately for all subsequent access requests. Activating a new policy version triggers a re-consent campaign for patients still bound to a prior version.",
      },
    ],
    history: [
      { date: "May 1, 2026", event: "v2.4 activated — re-consent campaign dispatched to 1,284 patients" },
      { date: "Apr 24, 2026", event: "v2.4 draft finalized and approved by Compliance Manager" },
      { date: "Apr 18, 2026", event: "v2.4 drafted from v2.3 — data-portability notice added" },
    ],
  },
  {
    version: "v2.3",
    slug: "v2-3",
    status: "archived",
    period: "Active Feb 12 – Apr 30, 2026",
    summary: "Introduces time-bounded consent expiration and re-consent campaigns.",
    adoption: 5,
    consents: 64,
    scopeCategories: 7,
    roleBindings: 3,
    sections: [
      { heading: "Purpose & scope", body: PURPOSE },
      {
        heading: "PHI categories covered",
        body: "Consent applies to seven record categories across the care team. Access is bound to the patient's assigned clinician.",
      },
      {
        heading: "Retention & data portability",
        body: "Medical records are retained for a minimum of seven years in line with HIPAA. Audit logs are retained for a minimum of six years.",
      },
      {
        heading: "Re-consent & revocation",
        body: "This version introduces time-bounded consent that expires after 12 months, after which a re-consent campaign is automatically triggered. Consent may be revoked by the patient at any time.",
      },
    ],
    history: [
      { date: "Apr 30, 2026", event: "v2.3 archived — superseded by v2.4" },
      { date: "Feb 12, 2026", event: "v2.3 activated" },
      { date: "Feb 5, 2026", event: "v2.3 drafted — time-bounded expiration added" },
    ],
  },
  {
    version: "v2.2",
    slug: "v2-2",
    status: "archived",
    period: "Active Sep 1, 2025 – Feb 11, 2026",
    summary: "Initial granular scope catalog.",
    adoption: 1,
    consents: 12,
    scopeCategories: 7,
    roleBindings: 3,
    sections: [
      { heading: "Purpose & scope", body: PURPOSE },
      {
        heading: "PHI categories covered",
        body: "Establishes the initial catalog of seven granular record categories that consent can be scoped to.",
      },
      {
        heading: "Retention & data portability",
        body: "Medical records are retained for a minimum of seven years in line with HIPAA.",
      },
      {
        heading: "Re-consent & revocation",
        body: "Consent may be revoked by the patient at any time, taking effect immediately.",
      },
    ],
    history: [
      { date: "Feb 11, 2026", event: "v2.2 archived — superseded by v2.3" },
      { date: "Sep 1, 2025", event: "v2.2 activated — first granular scope catalog" },
    ],
  },
];

export function getPolicy(slug: string): PolicyVersion | undefined {
  return POLICIES.find((p) => p.slug === slug);
}
