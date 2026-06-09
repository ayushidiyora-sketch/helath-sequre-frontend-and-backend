/**
 * Patient medical records.
 *
 * Prescriptions, clinical notes and discharge summaries come from the DB via
 * `/api/patient/records`. Lab Reports and Imaging have no dedicated backend
 * table yet (out of Phase-1 scope per the API route comment), so the records
 * below are demo entries that exist purely to drive the Lab Results and Imaging
 * **viewer UI**. Remove them once `lab_results` / `imaging_studies` tables land
 * and the API returns those categories.
 */

export type Category =
  | "Lab Report"
  | "Prescription"
  | "Imaging"
  | "Clinical Note"
  | "Discharge"
  | "Insurance"
  | "ID Proof"
  | "Other";

export interface MedicalRecord {
  id: string;
  title: string;
  category: Category;
  clinician: string;
  date: string;
  status: "Finalized" | "Active";
}

export interface ResultRow {
  marker: string;
  /** Display value, e.g. "13.2 g/dL". */
  result: string;
  /** Display reference range, e.g. "13.0 – 17.0". */
  reference: string;
  ok: boolean;
  /** Numeric value + bounds power the reference-range bar (optional). */
  value?: number;
  low?: number;
  high?: number;
  unit?: string;
  /** Explicit flag; computed from value/low/high when omitted. */
  flag?: "low" | "normal" | "high" | "critical";
}

export interface Prescription {
  drug: string;
  strength: string;
  form: string;
  frequency: string;
  duration: string;
  refills: string;
  instructions: string;
}

/** One image/frame in an imaging study (a DICOM series stand-in). */
export interface ImagingImage {
  id: string;
  label: string;
  /** Optional real image URL; when absent the viewer renders a scan placeholder. */
  src?: string;
}

/** One entry in a record's real access trail (from `record_access_log` + the
 *  record's own lifecycle timestamps). */
export interface AccessEvent {
  actor: string;
  /** e.g. "record.create" | "record.finalize" | "record.upload" | "record.view" | "record.download" */
  action: string;
  ip: string | null;
  /** ISO timestamp */
  at: string;
}

export interface RecordDetail extends MedicalRecord {
  /** Source table — "prescription" | "note" | "document". Absent for demo records. */
  kind?: string;
  subtitle: string;
  facility: string;
  collectionDate: string;
  /** Lab reports */
  results?: ResultRow[];
  /** Prescriptions */
  prescription?: Prescription;
  /** Imaging */
  findings?: string;
  impression?: string;
  images?: ImagingImage[];
  modality?: string;
  bodyPart?: string;
  /** Clinical notes / discharge summaries */
  noteBody?: string;
  /** Closing clinician note shown under the body */
  clinicianNote?: string;
  /** Uploaded clinical documents — the original file (base64 data URL) for preview/download. */
  fileUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number;
  /** Real per-record access trail (DB-backed). Absent for demo records. */
  accessLog?: AccessEvent[];
}

export const RECORDS: RecordDetail[] = [
  {
    id: "rec_lab_cbc_2026_05",
    title: "Complete Blood Count (CBC)",
    category: "Lab Report",
    clinician: "Dr. Priya Shah",
    date: "2026-05-12",
    status: "Finalized",
    subtitle: "Hematology panel · 6 markers",
    facility: "HealthSecure Diagnostics — Andheri",
    collectionDate: "2026-05-12 08:40",
    results: [
      { marker: "Hemoglobin", result: "12.4 g/dL", reference: "13.0 – 17.0", unit: "g/dL", value: 12.4, low: 13.0, high: 17.0, ok: false },
      { marker: "WBC", result: "7.1 ×10³/µL", reference: "4.0 – 11.0", unit: "×10³/µL", value: 7.1, low: 4.0, high: 11.0, ok: true },
      { marker: "Platelets", result: "210 ×10³/µL", reference: "150 – 410", unit: "×10³/µL", value: 210, low: 150, high: 410, ok: true },
      { marker: "Hematocrit", result: "38 %", reference: "40 – 50", unit: "%", value: 38, low: 40, high: 50, ok: false },
      { marker: "MCV", result: "84 fL", reference: "80 – 100", unit: "fL", value: 84, low: 80, high: 100, ok: true },
      { marker: "RDW", result: "15.8 %", reference: "11.5 – 14.5", unit: "%", value: 15.8, low: 11.5, high: 14.5, ok: false, flag: "high" },
    ],
  },
  {
    id: "rec_img_cxr_2026_05",
    title: "Chest X-ray (PA & Lateral)",
    category: "Imaging",
    clinician: "Dr. Rohan Iyer",
    date: "2026-05-15",
    status: "Finalized",
    subtitle: "Radiography · 2 views",
    facility: "HealthSecure Imaging Center — Bandra",
    collectionDate: "2026-05-15 11:20",
    modality: "DX (Digital Radiography)",
    bodyPart: "Chest",
    images: [
      { id: "img_pa", label: "PA view" },
      { id: "img_lat", label: "Lateral view" },
    ],
    findings:
      "Lungs are clear and well expanded with no focal consolidation, effusion, or pneumothorax. " +
      "Cardiomediastinal silhouette is within normal limits. Bony thorax is intact. No acute osseous abnormality.",
    impression: "No acute cardiopulmonary findings.",
  },
];

export function getRecord(id: string): RecordDetail | undefined {
  return RECORDS.find((r) => r.id === id);
}
