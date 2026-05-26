/**
 * Sensitive-access approval requests — staff asking to read PHI outside
 * their default scope (unassigned patients, cross-org auditors, new-hire
 * first access, etc.). Shared by the list, the detail page, and the
 * compliance dashboard widget.
 */

export type ApprovalStatus = "open" | "approved" | "rejected" | "info_requested";

export interface ApprovalRequest {
  id: string;
  requester: string;
  requesterEmail: string;
  requesterRole: string;
  flag: "Cross-org" | "Unassigned PHI" | "New hire" | "Bulk export" | "Off-panel";
  patientMrn: string;
  patientLabel: string;
  reason: string;
  scopeRequested: string[];
  durationHours: number;
  requestedAt: string;
  status: ApprovalStatus;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
}

export const OPEN_APPROVALS: ApprovalRequest[] = [
  {
    id: "req-001",
    requester: "Dr. R. Sharma",
    requesterEmail: "r.sharma@citygeneral",
    requesterRole: "Doctor · Internal Medicine",
    flag: "Unassigned PHI",
    patientMrn: "MRN-67890",
    patientLabel: "Patient MRN-67890",
    reason:
      "Patient came to the emergency room overnight. Their regular doctor (Dr. Verma) is on approved leave through May 30 and I'm covering. I need access to recent history to make safe emergency decisions.",
    scopeRequested: ["Clinical notes (3 months)", "Active prescriptions", "Lab reports (6 months)"],
    durationHours: 24,
    requestedAt: "May 26, 2026 · 09:30 AM IST",
    status: "open",
  },
  {
    id: "req-002",
    requester: "External auditor — Regulator",
    requesterEmail: "auditor@regulator.gov.in",
    requesterRole: "External Auditor · HIPAA",
    flag: "Cross-org",
    patientMrn: "—",
    patientLabel: "Full PHI metadata · May 2026",
    reason:
      "Quarterly HIPAA conformance review. Need metadata-only access (no PHI bodies) to all access events for May 2026 to verify consent enforcement.",
    scopeRequested: ["Audit event metadata", "Consent records (read-only)"],
    durationHours: 72,
    requestedAt: "May 25, 2026 · 04:12 PM IST",
    status: "open",
  },
  {
    id: "req-003",
    requester: "Dr. Aisha Khan",
    requesterEmail: "a.khan@citygeneral",
    requesterRole: "Doctor · Pediatrics (new hire)",
    flag: "New hire",
    patientMrn: "Panel: Pediatric · 142 patients",
    patientLabel: "Initial pediatric panel access",
    reason:
      "Starting first day on the pediatric panel. Department head Dr. Iyer has provisionally onboarded the panel; requesting compliance sign-off before opening records.",
    scopeRequested: ["Pediatric panel · assigned patients only", "Clinical notes", "Imaging"],
    durationHours: 8760, // 1 year, ongoing
    requestedAt: "May 26, 2026 · 08:05 AM IST",
    status: "open",
  },
];

export const DECIDED_APPROVALS: ApprovalRequest[] = [
  {
    id: "req-d001",
    requester: "Dr. M. Joshi",
    requesterEmail: "m.joshi@citygeneral",
    requesterRole: "Doctor · Cardiology",
    flag: "Off-panel",
    patientMrn: "MRN-44120",
    patientLabel: "Patient MRN-44120",
    reason: "Follow-up consult requested by primary cardiologist.",
    scopeRequested: ["Clinical notes", "ECG reports"],
    durationHours: 48,
    requestedAt: "May 22, 2026 · 11:14 AM IST",
    status: "approved",
    decidedAt: "May 22, 2026 · 12:02 PM IST",
    decidedBy: "Sai Compliance",
    decisionNote:
      "Approved with scope narrowed to clinical notes only. ECG already in shared cardiology workspace.",
  },
  {
    id: "req-d002",
    requester: "Vendor — Lab Sync",
    requesterEmail: "ops@labsync.example",
    requesterRole: "Vendor integration",
    flag: "Bulk export",
    patientMrn: "—",
    patientLabel: "Bulk lab result export · April 2026",
    reason: "Onboarding lab results from external partner; needed bulk export to validate mapping.",
    scopeRequested: ["Lab results metadata", "De-identified specimens"],
    durationHours: 12,
    requestedAt: "May 19, 2026 · 03:40 PM IST",
    status: "rejected",
    decidedAt: "May 19, 2026 · 05:11 PM IST",
    decidedBy: "Sai Compliance",
    decisionNote:
      "Rejected — bulk export not covered under current vendor DPA. Asked vendor to re-scope with row-level patient consent.",
  },
];

export function getApproval(id: string): ApprovalRequest | undefined {
  return [...OPEN_APPROVALS, ...DECIDED_APPROVALS].find((r) => r.id === id);
}

export function formatDuration(hours: number): string {
  if (hours >= 720) return `${Math.round(hours / 720)} months`;
  if (hours >= 168) return `${Math.round(hours / 168)} weeks`;
  if (hours >= 24) return `${Math.round(hours / 24)} days`;
  return `${hours} hours`;
}
