/**
 * GDPR right-to-be-forgotten / HIPAA right-of-access requests. Compliance
 * reviews each one against the active retention policy and decides which
 * data categories can be deleted now, which must be kept (and why), and
 * what gets exported.
 */

export type RequestType = "deletion" | "export";
export type RequestStatus =
  | "pending"
  | "in_progress"
  | "approved_partial"
  | "approved_full"
  | "rejected"
  | "blocked";

export interface DataCategoryDecision {
  key: string;
  label: string;
  held: string;
  retentionPolicy: string;
  /** "delete" = can purge now, "keep" = must retain, "export-only" = export but cannot delete */
  defaultDisposition: "delete" | "keep" | "export-only";
  reason: string;
  /** Plain-language line shown to the patient explaining the decision. */
  patientExplanation?: string;
}

/**
 * Per-category retention template — the policy copy + suggested disposition for
 * each of the six data categories, keyed for the dynamic categories API. The
 * `held` counts here are placeholders; the API overrides them with the
 * patient's real row counts. Patient labels match the right-to-be-forgotten
 * workflow spec.
 */
export const CATEGORY_TEMPLATES: Record<string, Omit<DataCategoryDecision, "held">> = {
  personal_info: {
    key: "personal_info",
    label: "Personal information (name, contact, address)",
    retentionPolicy: "GDPR right-to-be-forgotten · no statutory minimum",
    defaultDisposition: "delete",
    reason: "Patient request honored; no legal obligation to retain.",
    patientExplanation: "Your personal details will be removed — there is no legal requirement to keep them.",
  },
  recent_records: {
    key: "recent_records",
    label: "Medical records · last 7 years",
    retentionPolicy: "HIPAA · 7-year minimum from last encounter",
    defaultDisposition: "keep",
    reason: "Within HIPAA retention window. Must be retained until 7-year boundary lapses.",
    patientExplanation: "Your recent medical records cannot be deleted yet — healthcare regulations require them to be kept for seven years.",
  },
  old_records: {
    key: "old_records",
    label: "Medical records · older than 7 years",
    retentionPolicy: "Past statutory minimum",
    defaultDisposition: "delete",
    reason: "Retention window has lapsed. Safe to purge on patient request.",
    patientExplanation: "Medical records older than seven years are past the required retention window and will be deleted.",
  },
  audit_logs: {
    key: "audit_logs",
    label: "Audit logs (access events, consent changes)",
    retentionPolicy: "HIPAA · 6-year minimum",
    defaultDisposition: "keep",
    reason: "Within HIPAA minimum. Used as proof of consent enforcement during audits.",
    patientExplanation: "Access logs are retained as required proof that your data was handled correctly during audits.",
  },
  consent_records: {
    key: "consent_records",
    label: "Consent records (versions granted/revoked)",
    retentionPolicy: "Lifetime of relationship + 7 years",
    defaultDisposition: "keep",
    reason: "Required as proof of consent enforcement; cannot be deleted while statutory window is open.",
    patientExplanation: "Your consent history is kept as legal proof of what you authorized and when.",
  },
  messages: {
    key: "messages",
    label: "Secure messages with clinicians",
    retentionPolicy: "2 years (policy v2.4)",
    defaultDisposition: "delete",
    reason: "No statutory hold. Patient deletion request takes priority.",
    patientExplanation: "Your secure messages will be deleted — there is no legal hold requiring them to be kept.",
  },
};

/** Ordered list of the six category keys (drives display + execution order). */
export const CATEGORY_ORDER = [
  "personal_info",
  "recent_records",
  "old_records",
  "audit_logs",
  "consent_records",
  "messages",
] as const;

export interface DeletionRequest {
  id: string;
  patientName: string;
  patientMrn: string;
  patientEmail: string;
  type: RequestType;
  status: RequestStatus;
  requestedAt: string;
  channel: "Patient portal" | "Email" | "Phone (identity verified)";
  legalHold: boolean;
  legalHoldReason?: string;
  categories: DataCategoryDecision[];
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: string;
}

export const STANDARD_CATEGORIES: DataCategoryDecision[] = [
  {
    key: "personal_info",
    label: "Personal information (name, contact, address)",
    held: "Profile + 2 historical addresses",
    retentionPolicy: "GDPR right-to-be-forgotten · no statutory minimum",
    defaultDisposition: "delete",
    reason: "Patient request honored; no legal obligation to retain.",
  },
  {
    key: "recent_records",
    label: "Medical records · last 7 years",
    held: "32 clinical notes, 14 lab reports, 8 imaging studies",
    retentionPolicy: "HIPAA · 7-year minimum from last encounter",
    defaultDisposition: "keep",
    reason: "Within HIPAA retention window. Must be retained until 7-year boundary lapses.",
  },
  {
    key: "old_records",
    label: "Medical records · older than 7 years",
    held: "4 clinical notes, 2 lab reports",
    retentionPolicy: "Past statutory minimum",
    defaultDisposition: "delete",
    reason: "Retention window has lapsed. Safe to purge on patient request.",
  },
  {
    key: "audit_logs",
    label: "Audit logs (access events, consent changes)",
    held: "1,248 events linked to this patient",
    retentionPolicy: "HIPAA · 6-year minimum",
    defaultDisposition: "keep",
    reason: "Within HIPAA minimum. Used as proof of consent enforcement during audits.",
  },
  {
    key: "consent_records",
    label: "Consent records (versions granted/revoked)",
    held: "5 consent grants, 1 revocation",
    retentionPolicy: "Lifetime of relationship + 7 years",
    defaultDisposition: "keep",
    reason: "Required as proof of consent enforcement; cannot be deleted while statutory window is open.",
  },
  {
    key: "messages",
    label: "Secure messages with clinicians",
    held: "47 threads, 312 messages",
    retentionPolicy: "2 years (policy v2.4)",
    defaultDisposition: "delete",
    reason: "No statutory hold. Patient deletion request takes priority.",
  },
];

export const DELETION_REQUESTS: DeletionRequest[] = [
  {
    id: "del-001",
    patientName: "Tarun Mehta",
    patientMrn: "MRN-44120",
    patientEmail: "tarun.mehta@example.com",
    type: "deletion",
    status: "pending",
    requestedAt: "May 24, 2026 · 11:42 AM IST",
    channel: "Patient portal",
    legalHold: false,
    categories: STANDARD_CATEGORIES,
  },
  {
    id: "del-002",
    patientName: "Riya Mehta",
    patientMrn: "MRN-44119",
    patientEmail: "riya.mehta@example.com",
    type: "deletion",
    status: "approved_partial",
    requestedAt: "May 5, 2026 · 09:18 AM IST",
    channel: "Patient portal",
    legalHold: false,
    categories: STANDARD_CATEGORIES,
    decisionNote:
      "Partial deletion approved. Personal info, messages, and old records purged. Recent medical records and audit logs retained per HIPAA 7yr / 6yr minimums. Patient notified of what was kept and why.",
    decidedBy: "Sai Compliance",
    decidedAt: "May 5, 2026 · 02:11 PM IST",
  },
  {
    id: "del-003",
    patientName: "Aarav Mehta",
    patientMrn: "MRN-44118",
    patientEmail: "aarav.mehta@example.com",
    type: "export",
    status: "in_progress",
    requestedAt: "May 17, 2026 · 04:33 PM IST",
    channel: "Patient portal",
    legalHold: false,
    categories: STANDARD_CATEGORIES.map((c) => ({ ...c, defaultDisposition: "export-only" })),
  },
  {
    id: "del-004",
    patientName: "Vihaan Singh",
    patientMrn: "MRN-44210",
    patientEmail: "vihaan.singh@example.com",
    type: "deletion",
    status: "blocked",
    requestedAt: "Apr 30, 2026 · 10:02 AM IST",
    channel: "Email",
    legalHold: true,
    legalHoldReason: "Active malpractice litigation (case #2026-CV-104) — counsel requested 12-month hold.",
    categories: STANDARD_CATEGORIES,
  },
];

export function getDeletionRequest(id: string): DeletionRequest | undefined {
  return DELETION_REQUESTS.find((r) => r.id === id);
}
