"use client";

import { renderReportPdf } from "@/lib/report-pdf";
import type { ReportPayload, ReportSection } from "@/lib/report-types";

/**
 * Builds the patient's HIPAA right-of-access PHI export as a single
 * brand-styled PDF. Pulls REAL data from the patient's DB-backed API routes
 * (profile, medical records, prescriptions, appointments, documents, consents)
 * — not the demo store — and renders it through the shared `renderReportPdf`
 * engine so the document carries the same header/footer/pagination as every
 * other report in the app.
 *
 * Every fetch is best-effort: a failing section degrades to an empty table with
 * an explanatory note rather than aborting the whole export.
 */

interface ExportResult {
  filename: string;
  size: number;
  counts: { records: number; prescriptions: number; appointments: number; documents: number; consents: number };
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.ok) return null;
    return j as T;
  } catch {
    return null;
  }
}

/** "2026-06-11" or ISO → "Jun 11, 2026". Falls back to the raw string. */
function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Humanize a raw appointment status (client-side; mirrors statusLabel). */
function apptStatus(s: string): string {
  const map: Record<string, string> = {
    requested: "Requested",
    reschedule_requested: "Reschedule requested",
    confirmed: "Confirmed",
    arrived: "Arrived",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    rejected: "Declined",
    no_show: "No-show",
    blocked: "Blocked",
  };
  return map[s] ?? s;
}

const SCOPE_LABEL: Record<string, string> = {
  demographics: "Demographics",
  medications: "Medications",
  lab_results: "Lab results",
  imaging: "Imaging",
  notes: "Clinical notes",
  allergies: "Allergies",
  problems: "Problem list",
  immunizations: "Immunizations",
};

interface ProfileResp {
  profile: {
    name: string; email: string; phone: string | null; gender: string | null;
    dateOfBirth: string | null; tenantName: string | null; mrn: string; enrolledAt: string;
  };
  careTeam: { role: string; clinician: { name: string; department: string | null; designation: string | null } }[];
}
interface RecordsResp { records: { title: string; category: string; clinician: string; facility: string; date: string; status: string }[] }
interface RxResp { prescriptions: { drug: string; strength: string; frequency: string; duration: string; refills: number; clinicianName: string; status: string; finalizedAt: string | null; createdAt: string }[] }
interface ApptResp { appointments: { clinicianName: string; clinicianDepartment: string; date: string; time: string; durationMinutes: number; mode: string; status: string; notes: string | null }[] }
interface DocsResp { documents: { name: string; category: string; mimeType: string | null; scanStatus: string; uploadedAt: string }[] }
interface ConsentResp { requests: { clinicianName: string; clinicianDepartment: string; scopes: string[]; status: string; requestedAt: string; decidedAt: string | null; expiresAt: string | null }[] }

/**
 * Fetch all PHI, assemble a `ReportPayload`, render + download the PDF.
 * Returns counts so the caller can surface them in a toast.
 */
export async function exportPhiPdf(): Promise<ExportResult> {
  const [profileR, recordsR, rxR, apptR, docsR, consentR] = await Promise.all([
    getJson<ProfileResp>("/api/patient/profile"),
    getJson<RecordsResp>("/api/patient/records"),
    getJson<RxResp>("/api/patient/prescriptions"),
    getJson<ApptResp>("/api/patient/appointments"),
    getJson<DocsResp>("/api/patient/documents"),
    getJson<ConsentResp>("/api/patient/consent-requests"),
  ]);

  const records = recordsR?.records ?? [];
  const prescriptions = rxR?.prescriptions ?? [];
  const appointments = apptR?.appointments ?? [];
  const documents = docsR?.documents ?? [];
  const consents = consentR?.requests ?? [];
  const profile = profileR?.profile ?? null;
  const careTeam = profileR?.careTeam ?? [];

  const now = new Date();
  const sections: ReportSection[] = [];

  // 1. Summary banner.
  sections.push({
    kind: "paragraph",
    heading: "About this export",
    text:
      "This document is your complete Protected Health Information (PHI) export under your HIPAA " +
      "right of access. It contains the records HealthSecure holds for you across medical records, " +
      "prescriptions, appointments, uploaded documents, and consent grants. Generated on demand and " +
      "audit-logged. Keep it secure — it contains sensitive health data.",
  });

  // 2. Patient profile.
  if (profile) {
    sections.push({
      kind: "stats",
      heading: "Patient profile",
      stats: [
        { label: "Full name", value: profile.name || "—" },
        { label: "MRN", value: profile.mrn || "—" },
        { label: "Email", value: profile.email || "—" },
        { label: "Phone", value: profile.phone || "—" },
        { label: "Date of birth", value: fmtDate(profile.dateOfBirth) },
        { label: "Gender", value: profile.gender || "—" },
        { label: "Clinic", value: profile.tenantName || "—" },
        { label: "Enrolled", value: fmtDate(profile.enrolledAt) },
      ],
    });
  }

  // 3. Care team.
  sections.push({
    kind: "table",
    heading: "Care team",
    columns: ["Clinician", "Role", "Department"],
    rows: careTeam.map((c) => [
      c.clinician.name,
      c.role,
      c.clinician.department ?? c.clinician.designation ?? "—",
    ]),
    empty: "No clinicians are currently assigned to you.",
  });

  // 4. Medical records.
  sections.push({
    kind: "table",
    heading: `Medical records (${records.length})`,
    columns: ["Date", "Category", "Title", "Clinician", "Facility", "Status"],
    rows: records.map((r) => [fmtDate(r.date), r.category, r.title, r.clinician, r.facility || "—", r.status]),
    empty: "No medical records on file.",
  });

  // 5. Prescriptions.
  sections.push({
    kind: "table",
    heading: `Prescriptions (${prescriptions.length})`,
    columns: ["Date", "Medication", "Strength", "Frequency", "Duration", "Refills", "Prescriber", "Status"],
    rows: prescriptions.map((p) => [
      fmtDate(p.finalizedAt ?? p.createdAt),
      p.drug,
      p.strength || "—",
      p.frequency || "—",
      p.duration || "—",
      String(p.refills ?? 0),
      p.clinicianName,
      p.status,
    ]),
    empty: "No prescriptions on file.",
  });

  // 6. Appointments.
  sections.push({
    kind: "table",
    heading: `Appointments (${appointments.length})`,
    columns: ["Date", "Time", "Clinician", "Department", "Mode", "Status"],
    rows: appointments.map((a) => [
      fmtDate(a.date),
      a.time,
      a.clinicianName,
      a.clinicianDepartment,
      a.mode === "telehealth" ? "Telehealth" : "In-person",
      apptStatus(a.status),
    ]),
    empty: "No appointments on file.",
  });

  // 7. Documents.
  sections.push({
    kind: "table",
    heading: `Documents (${documents.length})`,
    columns: ["Uploaded", "Name", "Category", "Type", "Scan"],
    rows: documents.map((d) => [
      fmtDate(d.uploadedAt),
      d.name,
      d.category,
      d.mimeType ?? "—",
      d.scanStatus,
    ]),
    empty: "No documents uploaded.",
  });

  // 8. Consents.
  sections.push({
    kind: "table",
    heading: `Consents (${consents.length})`,
    columns: ["Status", "Clinician", "Scopes", "Requested", "Decided", "Expires"],
    rows: consents.map((c) => [
      c.status === "approved" ? "Active" : c.status.charAt(0).toUpperCase() + c.status.slice(1),
      c.clinicianName,
      c.scopes.map((s) => SCOPE_LABEL[s] ?? s).join(", "),
      fmtDate(c.requestedAt),
      fmtDate(c.decidedAt),
      c.expiresAt ? fmtDate(c.expiresAt) : "No expiry",
    ]),
    empty: "No consent grants on record.",
  });

  const payload: ReportPayload = {
    key: "phi-export",
    title: "Personal Health Information Export",
    description: "HIPAA right-of-access PHI bundle",
    generatedAt: now.toISOString(),
    generatedAtLabel: now.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    }),
    windowStart: null,
    windowEnd: null,
    sections,
  };

  const { filename, size } = renderReportPdf(payload);
  return {
    filename,
    size,
    counts: {
      records: records.length,
      prescriptions: prescriptions.length,
      appointments: appointments.length,
      documents: documents.length,
      consents: consents.length,
    },
  };
}
