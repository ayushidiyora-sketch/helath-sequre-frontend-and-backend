/**
 * Mock medical records — shared by the records list page and the record
 * detail page. Frontend-only demo data; no backend.
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

export const RECORDS: RecordDetail[] = [
  {
    id: "rec-lp-0518",
    title: "Lipid panel",
    category: "Lab Report",
    clinician: "Dr. Priya Shah",
    date: "May 18, 2026",
    status: "Finalized",
    subtitle: "Routine cardiovascular risk screening",
    facility: "City General Hospital",
    collectionDate: "May 17, 2026",
    results: [
      { marker: "Total cholesterol", result: "182 mg/dL", reference: "< 200", ok: true },
      { marker: "LDL cholesterol", result: "104 mg/dL", reference: "< 100", ok: false },
      { marker: "HDL cholesterol", result: "58 mg/dL", reference: "> 40", ok: true },
      { marker: "Triglycerides", result: "118 mg/dL", reference: "< 150", ok: true },
      { marker: "LDL/HDL ratio", result: "1.79", reference: "< 3.5", ok: true },
    ],
    clinicianNote:
      "Lipid profile is largely within target ranges. LDL is slightly above the optimal threshold given the patient's family history of cardiovascular disease. Recommend continued adherence to atorvastatin 20mg nightly, dietary modifications, and 150 min/week moderate aerobic activity. Re-screen in 12 weeks.",
  },
  {
    id: "rec-rx-0512",
    title: "Atorvastatin 20mg",
    category: "Prescription",
    clinician: "Dr. Priya Shah",
    date: "May 12, 2026",
    status: "Active",
    subtitle: "Lipid-lowering therapy",
    facility: "City General Hospital",
    collectionDate: "May 12, 2026",
    prescription: {
      drug: "Atorvastatin",
      strength: "20 mg",
      form: "Tablet",
      frequency: "Once nightly",
      duration: "90 days",
      refills: "2",
      instructions: "Take at bedtime. Avoid grapefruit juice. Report any unexplained muscle pain or weakness.",
    },
    clinicianNote:
      "Initiated for elevated LDL with a family history of cardiovascular disease. Re-screen lipids in 12 weeks and review tolerance.",
  },
  {
    id: "rec-img-0501",
    title: "Chest X-ray",
    category: "Imaging",
    clinician: "Radiology Dept.",
    date: "May 1, 2026",
    status: "Finalized",
    subtitle: "PA and lateral chest radiograph",
    facility: "City General Hospital · Radiology",
    collectionDate: "May 1, 2026",
    findings:
      "Lungs are clear and well expanded. No focal consolidation, pleural effusion, or pneumothorax. Cardiac silhouette is normal in size. Mediastinal and hilar contours are unremarkable. The visualised bony thorax is intact.",
    impression: "No acute cardiopulmonary abnormality.",
    clinicianNote: "Routine pre-procedure screening. No follow-up imaging required.",
  },
  {
    id: "rec-note-0428",
    title: "Follow-up consult note",
    category: "Clinical Note",
    clinician: "Dr. Priya Shah",
    date: "Apr 28, 2026",
    status: "Finalized",
    subtitle: "Cardiology follow-up visit",
    facility: "City General Hospital",
    collectionDate: "Apr 28, 2026",
    noteBody:
      "Patient reports good adherence to atorvastatin with no side effects. Blood pressure is well controlled and exercise tolerance has improved since the last visit. Dietary sodium reduction was discussed. Plan: continue the current regimen and review after the next lipid panel.",
  },
  {
    id: "rec-ds-0420",
    title: "Discharge summary",
    category: "Discharge",
    clinician: "Dr. Rohan Iyer",
    date: "Apr 20, 2026",
    status: "Finalized",
    subtitle: "Inpatient discharge",
    facility: "City General Hospital",
    collectionDate: "Apr 20, 2026",
    noteBody:
      "Admitted for observation following an episode of chest discomfort. Cardiac workup including ECG and serial troponin was unremarkable. Symptoms resolved with rest. The patient was discharged in stable condition with cardiology follow-up advised. No new medications were started.",
  },
  {
    id: "rec-cbc-0405",
    title: "Complete blood count",
    category: "Lab Report",
    clinician: "Dr. Rohan Iyer",
    date: "Apr 5, 2026",
    status: "Finalized",
    subtitle: "Routine haematology screen",
    facility: "City General Hospital",
    collectionDate: "Apr 4, 2026",
    results: [
      { marker: "Haemoglobin", result: "14.2 g/dL", reference: "13–17", ok: true },
      { marker: "White cell count", result: "7.1 ×10⁹/L", reference: "4–11", ok: true },
      { marker: "Platelets", result: "248 ×10⁹/L", reference: "150–410", ok: true },
      { marker: "Haematocrit", result: "42%", reference: "40–50", ok: true },
    ],
    clinicianNote: "All indices within normal limits. No evidence of anaemia or infection.",
  },
  {
    id: "rec-rx-0330",
    title: "Metformin 500mg",
    category: "Prescription",
    clinician: "Dr. Neha Kapoor",
    date: "Mar 30, 2026",
    status: "Active",
    subtitle: "Glycaemic control therapy",
    facility: "City General Hospital",
    collectionDate: "Mar 30, 2026",
    prescription: {
      drug: "Metformin",
      strength: "500 mg",
      form: "Tablet",
      frequency: "Twice daily with meals",
      duration: "90 days",
      refills: "3",
      instructions: "Take with food to reduce gastrointestinal upset. Monitor blood glucose as advised.",
    },
    clinicianNote: "Started for impaired fasting glucose. Recheck HbA1c in 3 months.",
  },
  {
    id: "rec-note-0318",
    title: "Cardiology review note",
    category: "Clinical Note",
    clinician: "Dr. Priya Shah",
    date: "Mar 18, 2026",
    status: "Finalized",
    subtitle: "Comprehensive cardiology review",
    facility: "City General Hospital",
    collectionDate: "Mar 18, 2026",
    noteBody:
      "Comprehensive cardiology review. ECG shows normal sinus rhythm. Echocardiogram demonstrates a preserved ejection fraction with no regional wall motion abnormality. Cardiovascular risk factors are being actively managed. The patient was counselled on lifestyle measures.",
  },
  {
    id: "rec-lp-0302",
    title: "Thyroid function test",
    category: "Lab Report",
    clinician: "Dr. Neha Kapoor",
    date: "Mar 2, 2026",
    status: "Finalized",
    subtitle: "Thyroid hormone assessment",
    facility: "City General Hospital",
    collectionDate: "Mar 1, 2026",
    results: [
      { marker: "TSH", result: "2.1 mIU/L", reference: "0.4–4.0", ok: true },
      { marker: "Free T4", result: "1.3 ng/dL", reference: "0.8–1.8", ok: true },
      { marker: "Free T3", result: "3.2 pg/mL", reference: "2.3–4.2", ok: true },
    ],
    clinicianNote: "Thyroid function is normal. No intervention required.",
  },
  {
    id: "rec-img-0214",
    title: "Abdominal ultrasound",
    category: "Imaging",
    clinician: "Radiology Dept.",
    date: "Feb 14, 2026",
    status: "Finalized",
    subtitle: "Ultrasound of the abdomen",
    facility: "City General Hospital · Radiology",
    collectionDate: "Feb 14, 2026",
    findings:
      "Liver is normal in size and echotexture. Gallbladder is distended without stones or wall thickening. Both kidneys are normal in size with no hydronephrosis. No free fluid is seen. Pancreas and spleen are unremarkable.",
    impression: "Normal abdominal ultrasound.",
    clinicianNote: "Performed for mild non-specific abdominal discomfort. Reassurance given.",
  },
  {
    id: "rec-rx-0128",
    title: "Amlodipine 5mg",
    category: "Prescription",
    clinician: "Dr. Priya Shah",
    date: "Jan 28, 2026",
    status: "Active",
    subtitle: "Antihypertensive therapy",
    facility: "City General Hospital",
    collectionDate: "Jan 28, 2026",
    prescription: {
      drug: "Amlodipine",
      strength: "5 mg",
      form: "Tablet",
      frequency: "Once daily",
      duration: "90 days",
      refills: "2",
      instructions: "Take at the same time each day. Report ankle swelling or persistent dizziness.",
    },
    clinicianNote: "Prescribed for mild hypertension. Monitor blood pressure; titrate at the next visit if required.",
  },
  {
    id: "rec-lp-0112",
    title: "HbA1c test",
    category: "Lab Report",
    clinician: "Dr. Neha Kapoor",
    date: "Jan 12, 2026",
    status: "Finalized",
    subtitle: "Glycated haemoglobin assessment",
    facility: "City General Hospital",
    collectionDate: "Jan 11, 2026",
    results: [
      { marker: "HbA1c", result: "5.9 %", reference: "< 5.7", ok: false },
      { marker: "Estimated average glucose", result: "123 mg/dL", reference: "< 117", ok: false },
    ],
    clinicianNote:
      "Result is in the pre-diabetic range. Lifestyle modification advised; recheck in 3 months.",
  },
  {
    id: "rec-note-1220",
    title: "Annual physical note",
    category: "Clinical Note",
    clinician: "Dr. Rohan Iyer",
    date: "Dec 20, 2025",
    status: "Finalized",
    subtitle: "Annual health maintenance visit",
    facility: "City General Hospital",
    collectionDate: "Dec 20, 2025",
    noteBody:
      "Annual health maintenance visit. General examination is unremarkable and vital signs are within normal limits. Immunisations are up to date. Age-appropriate preventive screening was discussed and scheduled.",
  },
  {
    id: "rec-ds-1108",
    title: "Day-care discharge",
    category: "Discharge",
    clinician: "Dr. Rohan Iyer",
    date: "Nov 8, 2025",
    status: "Finalized",
    subtitle: "Day-care procedure discharge",
    facility: "City General Hospital",
    collectionDate: "Nov 8, 2025",
    noteBody:
      "Day-care admission for a minor outpatient procedure. The procedure was completed without complication. The patient was observed for four hours and discharged in stable condition with routine after-care instructions.",
  },
  {
    id: "rec-img-0930",
    title: "Knee MRI",
    category: "Imaging",
    clinician: "Radiology Dept.",
    date: "Sep 30, 2025",
    status: "Finalized",
    subtitle: "MRI of the right knee",
    facility: "City General Hospital · Radiology",
    collectionDate: "Sep 30, 2025",
    findings:
      "Mild signal change is seen in the posterior horn of the medial meniscus without a discrete tear. Articular cartilage is preserved. Cruciate and collateral ligaments are intact. There is a small joint effusion. No marrow oedema is identified.",
    impression: "Mild degenerative meniscal change. No acute tear.",
    clinicianNote: "Conservative management advised — physiotherapy and activity modification.",
  },
  {
    id: "rec-lp-0815",
    title: "Vitamin D panel",
    category: "Lab Report",
    clinician: "Dr. Neha Kapoor",
    date: "Aug 15, 2025",
    status: "Finalized",
    subtitle: "Vitamin D status assessment",
    facility: "City General Hospital",
    collectionDate: "Aug 14, 2025",
    results: [
      { marker: "25-hydroxy Vitamin D", result: "22 ng/mL", reference: "30–100", ok: false },
    ],
    clinicianNote:
      "Vitamin D insufficiency. Supplementation with 60,000 IU weekly for 8 weeks advised, then recheck.",
  },
];

export function getRecord(id: string): RecordDetail | undefined {
  return RECORDS.find((r) => r.id === id);
}
