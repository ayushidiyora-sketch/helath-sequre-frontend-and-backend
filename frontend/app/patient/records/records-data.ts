/**
 * Patient medical records.
 *
 * No demo data — the array is intentionally empty until a real backend table
 * exists. Pages that consume this (`/patient/records`, `/patient/records/[id]`,
 * `/patient/prescriptions`) render their empty-state copy when `RECORDS` is
 * empty. Add records via the API once the `medical_records` Prisma model lands.
 */

export type Category =
  | "Lab Report"
  | "Prescription"
  | "Imaging"
  | "Clinical Note"
  | "Discharge";

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
  result: string;
  reference: string;
  ok: boolean;
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

export interface RecordDetail extends MedicalRecord {
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
  /** Clinical notes / discharge summaries */
  noteBody?: string;
  /** Closing clinician note shown under the body */
  clinicianNote?: string;
}

export const RECORDS: RecordDetail[] = [];

export function getRecord(id: string): RecordDetail | undefined {
  return RECORDS.find((r) => r.id === id);
}
