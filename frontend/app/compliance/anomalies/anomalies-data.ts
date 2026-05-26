/**
 * Mock anomaly records — shared by the compliance dashboard widget,
 * the anomalies list page, and the anomaly detail page.
 */

export interface Anomaly {
  id: string;
  sev: "high" | "medium";
  title: string;
  summary: string; // short line for list/dashboard
  description: string; // full explanation
  actor: string;
  ip: string;
  events: number;
  time: string; // relative, e.g. "2h ago"
  detectedAt: string;
  window: string;
  evidence: string[];
  recommendation: string;
}

export const OPEN_ANOMALIES: Anomaly[] = [
  {
    id: "bulk-document-download",
    sev: "high",
    title: "Bulk document download — Dr. K. Patel",
    summary: "32 documents in 4 minutes · 2:14 AM IST · 198.51.100.7",
    description:
      "32 documents were downloaded in a 4-minute span between 2:14 AM and 2:18 AM IST. This is an off-hours burst well outside the clinician's normal activity, and the source IP is residential.",
    actor: "k.patel@citygeneral",
    ip: "198.51.100.7",
    events: 32,
    time: "2h ago",
    detectedAt: "May 22, 2026 · 2:18 AM IST",
    window: "Off-hours (00:00–05:00)",
    evidence: [
      "32 document.download events recorded within 240 seconds",
      "Source IP 198.51.100.7 — residential, first seen for this account",
      "No appointment or active care episode linked to the downloads",
      "Account's 30-day average is 3 downloads per day",
    ],
    recommendation:
      "Contact Dr. Patel to confirm intent. If unverified within 24 hours, open an incident and revoke the active session.",
  },
  {
    id: "repeated-failed-mfa",
    sev: "medium",
    title: "Repeated failed MFA — auditor@regulator",
    summary: "4 failures in 90s · 203.0.113.42 · escalated to MFA lockout",
    description:
      "Four MFA challenges failed within 90 seconds from 203.0.113.42. The account was automatically locked once the attempt threshold was reached.",
    actor: "auditor@regulator",
    ip: "203.0.113.42",
    events: 4,
    time: "5h ago",
    detectedAt: "May 22, 2026 · 9:41 AM IST",
    window: "Business hours",
    evidence: [
      "4 auth.mfa_failure events in 90 seconds",
      "Account auto-locked per the 5-attempt lockout policy",
      "Password verification succeeded — only the MFA step failed",
      "No prior failed attempts from this IP in the last 30 days",
    ],
    recommendation:
      "Most likely a lost or reset authenticator device. Verify the auditor's identity out-of-band before unlocking the account.",
  },
  {
    id: "off-hours-phi-access",
    sev: "medium",
    title: "Off-hours PHI access — Dr. R. Iyer",
    summary: "Records view at 3:02 AM IST (off-hours window 0–5)",
    description:
      "A medical record was viewed at 3:02 AM IST, outside Dr. Iyer's typical 8 AM–6 PM working window.",
    actor: "r.iyer@citygeneral",
    ip: "10.0.0.42",
    events: 1,
    time: "Yesterday",
    detectedAt: "May 21, 2026 · 3:02 AM IST",
    window: "Off-hours (00:00–05:00)",
    evidence: [
      "1 records.read event at 03:02 AM IST",
      "Record is within the clinician's assigned panel — consent valid",
      "Clinician's typical activity window is 08:00–18:00",
      "On-call roster shows Dr. Iyer was on call last night",
    ],
    recommendation:
      "The on-call roster explains the access. Low risk — dismiss unless the patient was outside the assigned panel.",
  },
  {
    id: "consent-revoked-access",
    sev: "medium",
    title: "Consent revocation followed by access attempt",
    summary: "Dr. P. Shah · denied with consent_revoked",
    description:
      "Dr. P. Shah attempted to read a record one second after the patient Aarav Mehta revoked consent. The access was correctly denied at the API layer.",
    actor: "p.shah@citygeneral",
    ip: "10.0.0.42",
    events: 1,
    time: "Yesterday",
    detectedAt: "May 21, 2026 · 11:32 AM IST",
    window: "Business hours",
    evidence: [
      "consent.revoke by patient Aarav Mehta at 11:32:50",
      "records.read attempt by Dr. Shah at 11:32:51 — denied",
      "Denial reason recorded: consent_revoked",
      "No PHI was returned in the response payload",
    ],
    recommendation:
      "The consent guard worked as designed and no PHI leaked. Dismiss — this is expected behavior, surfaced for completeness.",
  },
];

export interface ClosedAnomaly {
  title: string;
  outcome: "Legitimate" | "Rule tuned" | "Incident opened";
  reviewer: string;
  date: string;
  justification: string;
}

export const CLOSED_ANOMALIES: ClosedAnomaly[] = [
  {
    title: "Locked-out staff account",
    outcome: "Legitimate",
    reviewer: "Sai Compliance",
    date: "May 14",
    justification:
      "User reset authenticator after device loss. Identity verified by Mr. Patel out-of-band.",
  },
  {
    title: "IP geolocation mismatch",
    outcome: "Rule tuned",
    reviewer: "Sai Compliance",
    date: "May 10",
    justification:
      "Approved VPN egress from Mumbai office added to allowlist. Rule no longer fires for this CIDR.",
  },
];

export function getAnomaly(id: string): Anomaly | undefined {
  return OPEN_ANOMALIES.find((a) => a.id === id);
}
