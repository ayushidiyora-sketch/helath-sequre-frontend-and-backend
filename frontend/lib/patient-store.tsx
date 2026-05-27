"use client";

import * as React from "react";

/* ============================================================================
 * Patient portal local store
 *
 * Demo-only persistence. Holds every entity surfaced by the patient pages
 * (appointments, documents, consents, message threads, notifications, profile,
 * security) in React state, mirrors changes to localStorage on every mutation,
 * and rehydrates on first client render. Production replaces this with API
 * fetches + a server-rendered cache.
 * ========================================================================== */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppointmentMode = "in-person" | "telehealth";
export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no-show";

export interface Appointment {
  id: string;
  clinician: string;
  department: string;
  date: string; // ISO yyyy-mm-dd
  time: string; // "10:00 AM"
  mode: AppointmentMode;
  status: AppointmentStatus;
  reason: string;
  documentIds: string[];
  createdAt: string;
}

export type DocumentCategory =
  | "Lab Report"
  | "Imaging"
  | "Prescription"
  | "Insurance"
  | "ID Proof"
  | "Other";

export type DocumentScanStatus = "pending_scan" | "clean" | "infected";

export interface PatientDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  sizeBytes: number;
  uploadedAt: string;
  scanStatus: DocumentScanStatus;
  uploadedBy: "patient" | "clinician";
  uploaderName?: string;
}

export type ConsentScope =
  | "lab"
  | "prescriptions"
  | "notes"
  | "imaging"
  | "mental_health";

export const CONSENT_SCOPE_LABEL: Record<ConsentScope, string> = {
  lab: "Lab Reports",
  prescriptions: "Prescriptions",
  notes: "Clinical Notes",
  imaging: "Imaging",
  mental_health: "Mental Health",
};

export interface Consent {
  id: string;
  clinician: string;
  department?: string;
  scopes: ConsentScope[];
  policyVersion: string;
  grantedAt: string;
  status: "active" | "revoked";
  revokedAt?: string;
  expiresAt?: string | null;
}

export interface MessageAttachment {
  name: string;
  size: number;
  kind: "file" | "image";
}

export interface Message {
  id: string;
  from: "patient" | "clinician";
  fromName: string;
  body: string;
  at: string;
  attachments?: MessageAttachment[];
}

export interface MessageThread {
  id: string;
  with: string;
  withRole: string;
  subject: string;
  unread: boolean;
  pinned: boolean;
  messages: Message[];
  lastActivity: string;
}

export type NotificationType =
  | "appointment"
  | "record"
  | "message"
  | "consent"
  | "security";

export interface PatientNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface Session {
  id: string;
  device: string;
  location: string;
  lastSeen: string;
  current: boolean;
  ip?: string;
  trusted?: boolean;
}

export interface Security {
  mfaEnabled: boolean;
  sessions: Session[];
}

export type FamilyRelationship = "Spouse" | "Child" | "Parent" | "Sibling" | "Guardian" | "Other";

export interface FamilyMember {
  id: string;
  name: string;
  relationship: FamilyRelationship;
  dob: string;
  isMinor: boolean;
  canManageAccount: boolean;
  phone?: string;
  email?: string;
  notes?: string;
  addedAt: string;
}

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "Unknown";

export interface EmergencyContact {
  primaryName: string;
  primaryRelationship: string;
  primaryPhone: string;
  secondaryName?: string;
  secondaryRelationship?: string;
  secondaryPhone?: string;
  bloodGroup: BloodGroup;
  allergies: string[];
  criticalMedications: string[];
  medicalIds: { label: string; value: string }[];
  organDonor: boolean;
  preferredHospital?: string;
  updatedAt: string;
}

export type InsuranceCoverageType = "Self" | "Family" | "Spouse" | "Children";
export type PreAuthStatus = "none" | "pending" | "approved" | "denied";

export interface InsurancePlan {
  id: string;
  provider: string;
  planName: string;
  policyNumberMasked: string;
  groupNumber?: string;
  memberId?: string;
  coverageType: InsuranceCoverageType;
  startDate: string;
  endDate?: string;
  isPrimary: boolean;
  cardFrontFileName?: string;
  cardBackFileName?: string;
  preAuthorizationStatus: PreAuthStatus;
  notes?: string;
  addedAt: string;
}

export interface VaccinationRecord {
  id: string;
  vaccine: string;
  manufacturer?: string;
  doseNumber: number;
  totalDoses?: number;
  administeredOn: string;
  administeredBy?: string;
  lotNumber?: string;
  nextDoseDue?: string;
  certificateFileName?: string;
  forTravel: boolean;
  notes?: string;
}

export interface PatientState {
  hydrated: boolean;
  appointments: Appointment[];
  documents: PatientDocument[];
  consents: Consent[];
  threads: MessageThread[];
  notifications: PatientNotification[];
  profile: Profile;
  security: Security;
  family: FamilyMember[];
  emergencyContact: EmergencyContact;
  insurance: InsurancePlan[];
  vaccinations: VaccinationRecord[];
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function isoDaysFromNow(days: number, hour = 10, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

function dateOnly(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeSeed(): Omit<PatientState, "hydrated"> {
  return {
    appointments: [
      {
        id: "apt-1",
        clinician: "Dr. Priya Shah",
        department: "Cardiology",
        date: dateOnly(2),
        time: "10:00 AM",
        mode: "in-person",
        status: "confirmed",
        reason: "Chest pain follow-up",
        documentIds: ["doc-1"],
        createdAt: isoDaysFromNow(-3),
      },
      {
        id: "apt-2",
        clinician: "Dr. Rohan Iyer",
        department: "General Medicine",
        date: dateOnly(-7),
        time: "2:30 PM",
        mode: "telehealth",
        status: "completed",
        reason: "Annual physical",
        documentIds: [],
        createdAt: isoDaysFromNow(-14),
      },
    ],
    documents: [
      {
        id: "doc-1",
        name: "Previous ECG report.pdf",
        category: "Lab Report",
        sizeBytes: 124_300,
        uploadedAt: isoDaysFromNow(-3),
        scanStatus: "clean",
        uploadedBy: "patient",
      },
      {
        id: "doc-2",
        name: "Insurance card.pdf",
        category: "Insurance",
        sizeBytes: 84_120,
        uploadedAt: isoDaysFromNow(-12),
        scanStatus: "clean",
        uploadedBy: "patient",
      },
      {
        id: "doc-3",
        name: "Echo Test Report.pdf",
        category: "Imaging",
        sizeBytes: 412_000,
        uploadedAt: isoDaysFromNow(-1),
        scanStatus: "clean",
        uploadedBy: "clinician",
        uploaderName: "Dr. Priya Shah",
      },
    ],
    consents: [
      {
        id: "con-1",
        clinician: "Dr. Priya Shah",
        department: "Cardiology",
        scopes: ["lab", "prescriptions", "notes", "imaging"],
        policyVersion: "v2.4",
        grantedAt: isoDaysFromNow(-3),
        status: "active",
        expiresAt: null,
      },
    ],
    threads: [
      {
        id: "thr-1",
        with: "Dr. Priya Shah",
        withRole: "Cardiology",
        subject: "Aspirin question",
        unread: false,
        pinned: false,
        messages: [
          {
            id: "msg-1",
            from: "patient",
            fromName: "You",
            body: "Doctor, I started Aspirin 2 days ago. Feeling slight stomach discomfort. Should I continue or stop?",
            at: isoDaysFromNow(-2, 11, 0),
          },
          {
            id: "msg-2",
            from: "clinician",
            fromName: "Dr. Priya Shah",
            body: "Take Aspirin with food, not empty stomach. If discomfort continues, stop and contact me.",
            at: isoDaysFromNow(-2, 14, 0),
          },
        ],
        lastActivity: isoDaysFromNow(-2, 14, 0),
      },
    ],
    notifications: [
      {
        id: "ntf-1",
        title: "Appointment reminder",
        body: "Your appointment with Dr. Priya Shah is in 2 days.",
        type: "appointment",
        href: "/patient/appointments",
        read: false,
        createdAt: isoDaysFromNow(-1, 9, 0),
      },
      {
        id: "ntf-2",
        title: "New record available",
        body: "Dr. Priya Shah uploaded your Echo Test Report.",
        type: "record",
        href: "/patient/documents",
        read: false,
        createdAt: isoDaysFromNow(-1, 16, 0),
      },
    ],
    profile: {
      firstName: "Aarav",
      lastName: "Mehta",
      email: "aarav.mehta@example.com",
      phone: "+91 98765 43210",
      dob: "1981-04-14",
      address: "Flat 302, Sky Heights",
      city: "Ahmedabad",
      state: "Gujarat",
      postalCode: "380015",
    },
    security: {
      mfaEnabled: false,
      sessions: [
        {
          id: "ses-1",
          device: "Chrome · Windows 10",
          location: "Ahmedabad, IN",
          ip: "203.0.113.42",
          lastSeen: new Date().toISOString(),
          current: true,
          trusted: true,
        },
        {
          id: "ses-2",
          device: "Safari · iPhone 14",
          location: "Ahmedabad, IN",
          ip: "203.0.113.99",
          lastSeen: isoDaysFromNow(-3, 21, 0),
          current: false,
          trusted: true,
        },
        {
          id: "ses-3",
          device: "Firefox · Ubuntu 22.04",
          location: "Mumbai, IN",
          ip: "198.51.100.7",
          lastSeen: isoDaysFromNow(-9, 14, 35),
          current: false,
          trusted: false,
        },
      ],
    },
    family: [
      {
        id: "fam-spouse",
        name: "Aanya Sharma",
        relationship: "Spouse",
        dob: "1992-08-14",
        isMinor: false,
        canManageAccount: true,
        phone: "+91 98201 11111",
        email: "aanya.sharma@example.com",
        notes: "Authorised caregiver — can manage appointments on my behalf.",
        addedAt: isoDaysFromNow(-90),
      },
      {
        id: "fam-child",
        name: "Vivaan Sharma",
        relationship: "Child",
        dob: "2018-03-22",
        isMinor: true,
        canManageAccount: false,
        phone: "+91 98201 22222",
        notes: "Pediatrician: Dr. Priya Shah at City General.",
        addedAt: isoDaysFromNow(-60),
      },
    ],
    emergencyContact: {
      primaryName: "Aanya Sharma",
      primaryRelationship: "Spouse",
      primaryPhone: "+91 98201 11111",
      secondaryName: "Rajiv Sharma",
      secondaryRelationship: "Parent",
      secondaryPhone: "+91 98201 33333",
      bloodGroup: "O+",
      allergies: ["Penicillin", "Sulfa drugs"],
      criticalMedications: ["Atorvastatin 10mg (daily)"],
      medicalIds: [
        { label: "Diabetic", value: "Type 2 since 2022" },
        { label: "Hypertension", value: "Controlled with medication" },
      ],
      organDonor: true,
      preferredHospital: "City General Hospital, Ahmedabad",
      updatedAt: isoDaysFromNow(-14),
    },
    insurance: [
      {
        id: "ins-star",
        provider: "Star Health",
        planName: "Family Health Optima",
        policyNumberMasked: "XXXXXX4471",
        groupNumber: "GH-2024",
        memberId: "MEM-998812",
        coverageType: "Family",
        startDate: "2024-04-01",
        endDate: "2026-03-31",
        isPrimary: true,
        cardFrontFileName: "star-health-card.pdf",
        preAuthorizationStatus: "none",
        notes: "Cashless network — City General is in-network.",
        addedAt: isoDaysFromNow(-180),
      },
      {
        id: "ins-hdfc",
        provider: "HDFC Ergo",
        planName: "Optima Restore",
        policyNumberMasked: "XXXXXX8820",
        memberId: "HDFCE-44712",
        coverageType: "Self",
        startDate: "2025-01-15",
        endDate: "2026-01-14",
        isPrimary: false,
        preAuthorizationStatus: "approved",
        notes: "Top-up plan for hospitalisation > ₹5L.",
        addedAt: isoDaysFromNow(-100),
      },
    ],
    vaccinations: [
      {
        id: "vac-covid-1",
        vaccine: "COVID-19 (Covishield)",
        manufacturer: "Serum Institute",
        doseNumber: 2,
        totalDoses: 2,
        administeredOn: "2023-09-12",
        administeredBy: "City General Hospital",
        lotNumber: "CSH-2023-0912-A",
        certificateFileName: "covishield-dose2-cert.pdf",
        forTravel: false,
      },
      {
        id: "vac-flu",
        vaccine: "Influenza (Quadrivalent)",
        manufacturer: "Sanofi",
        doseNumber: 1,
        totalDoses: 1,
        administeredOn: dateOnly(-60),
        administeredBy: "Dr. Priya Shah",
        nextDoseDue: dateOnly(305),
        forTravel: false,
      },
      {
        id: "vac-tetanus",
        vaccine: "Tetanus / Tdap",
        doseNumber: 1,
        totalDoses: 1,
        administeredOn: "2024-01-10",
        administeredBy: "City General Hospital",
        nextDoseDue: "2034-01-10",
        forTravel: false,
      },
      {
        id: "vac-yellow",
        vaccine: "Yellow Fever",
        manufacturer: "Bio-Manguinhos",
        doseNumber: 1,
        totalDoses: 1,
        administeredOn: dateOnly(-180),
        administeredBy: "Travel Health Clinic",
        certificateFileName: "yellow-fever-icvp.pdf",
        forTravel: true,
        notes: "Required for travel to Brazil. Lifelong protection.",
      },
      {
        id: "vac-hep-b",
        vaccine: "Hepatitis B",
        doseNumber: 2,
        totalDoses: 3,
        administeredOn: dateOnly(-30),
        administeredBy: "Dr. Rohan Iyer",
        nextDoseDue: dateOnly(20),
        forTravel: false,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const STORAGE_KEY = "hs_patient_store_v2";

function loadFromStorage(): Omit<PatientState, "hydrated"> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Omit<PatientState, "hydrated">;
  } catch {
    return null;
  }
}

function saveToStorage(state: Omit<PatientState, "hydrated">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

interface StoreActions {
  // appointments
  addAppointment(a: Omit<Appointment, "id" | "createdAt" | "status">): Appointment;
  rescheduleAppointment(id: string, date: string, time: string): void;
  cancelAppointment(id: string): void;
  completeAppointment(id: string): void;
  // documents
  addDocument(d: Omit<PatientDocument, "id" | "uploadedAt" | "scanStatus" | "uploadedBy"> & { uploadedBy?: PatientDocument["uploadedBy"] }): PatientDocument;
  deleteDocument(id: string): void;
  setDocumentScan(id: string, scan: DocumentScanStatus): void;
  // consents
  addConsent(c: Omit<Consent, "id" | "grantedAt" | "status">): Consent;
  updateConsentScopes(id: string, scopes: ConsentScope[]): void;
  revokeConsent(id: string): void;
  // threads
  createThread(opts: { with: string; withRole: string; subject: string; initialBody: string }): MessageThread;
  sendMessage(threadId: string, body: string, attachments?: MessageAttachment[]): void;
  markThreadRead(threadId: string): void;
  togglePinThread(threadId: string): void;
  // notifications
  markNotificationRead(id: string): void;
  markAllNotificationsRead(): void;
  addNotification(n: Omit<PatientNotification, "id" | "createdAt" | "read">): void;
  // profile
  updateProfile(patch: Partial<Profile>): void;
  // security
  setMfaEnabled(enabled: boolean): void;
  revokeSession(id: string): void;
  // family
  addFamilyMember(p: Omit<FamilyMember, "id" | "addedAt">): FamilyMember;
  updateFamilyMember(id: string, patch: Partial<Omit<FamilyMember, "id" | "addedAt">>): void;
  removeFamilyMember(id: string): void;
  // emergency contact
  updateEmergencyContact(patch: Partial<Omit<EmergencyContact, "updatedAt">>): void;
  // insurance
  addInsurancePlan(p: Omit<InsurancePlan, "id" | "addedAt">): InsurancePlan;
  updateInsurancePlan(id: string, patch: Partial<Omit<InsurancePlan, "id" | "addedAt">>): void;
  removeInsurancePlan(id: string): void;
  markPrimaryInsurance(id: string): void;
  // vaccinations
  addVaccination(v: Omit<VaccinationRecord, "id">): VaccinationRecord;
  updateVaccination(id: string, patch: Partial<Omit<VaccinationRecord, "id">>): void;
  removeVaccination(id: string): void;
  // demo
  resetDemo(): void;
  clearDemo(): void;
}

const Ctx = React.createContext<({ state: PatientState } & StoreActions) | null>(null);

export function PatientStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<PatientState>(() => ({
    hydrated: false,
    ...makeSeed(),
  }));

  // Hydrate from localStorage on first client mount.
  React.useEffect(() => {
    const stored = loadFromStorage();
    setState({ hydrated: true, ...(stored ?? makeSeed()) });
  }, []);

  // Persist on every mutation (after hydration).
  React.useEffect(() => {
    if (!state.hydrated) return;
    const { hydrated: _h, ...persistable } = state;
    void _h;
    saveToStorage(persistable);
  }, [state]);

  const actions = React.useMemo<StoreActions>(() => {
    const mutate = (fn: (prev: PatientState) => PatientState) => setState((prev) => fn(prev));

    return {
      addAppointment(a) {
        const apt: Appointment = {
          id: newId("apt"),
          createdAt: new Date().toISOString(),
          status: "requested",
          ...a,
        };
        mutate((prev) => ({ ...prev, appointments: [apt, ...prev.appointments] }));
        return apt;
      },
      rescheduleAppointment(id, date, time) {
        mutate((prev) => ({
          ...prev,
          appointments: prev.appointments.map((x) =>
            x.id === id ? { ...x, date, time, status: "confirmed" } : x,
          ),
        }));
      },
      cancelAppointment(id) {
        mutate((prev) => ({
          ...prev,
          appointments: prev.appointments.map((x) =>
            x.id === id ? { ...x, status: "cancelled" } : x,
          ),
        }));
      },
      completeAppointment(id) {
        mutate((prev) => ({
          ...prev,
          appointments: prev.appointments.map((x) =>
            x.id === id ? { ...x, status: "completed" } : x,
          ),
        }));
      },

      addDocument(d) {
        const doc: PatientDocument = {
          id: newId("doc"),
          uploadedAt: new Date().toISOString(),
          scanStatus: "pending_scan",
          uploadedBy: d.uploadedBy ?? "patient",
          ...d,
        };
        mutate((prev) => ({ ...prev, documents: [doc, ...prev.documents] }));
        // Simulate ClamAV pipeline.
        setTimeout(() => {
          mutate((prev) => ({
            ...prev,
            documents: prev.documents.map((x) =>
              x.id === doc.id ? { ...x, scanStatus: "clean" } : x,
            ),
          }));
        }, 1500);
        return doc;
      },
      deleteDocument(id) {
        mutate((prev) => ({
          ...prev,
          documents: prev.documents.filter((x) => x.id !== id),
        }));
      },
      setDocumentScan(id, scan) {
        mutate((prev) => ({
          ...prev,
          documents: prev.documents.map((x) =>
            x.id === id ? { ...x, scanStatus: scan } : x,
          ),
        }));
      },

      addConsent(c) {
        const con: Consent = {
          id: newId("con"),
          grantedAt: new Date().toISOString(),
          status: "active",
          ...c,
        };
        mutate((prev) => ({ ...prev, consents: [con, ...prev.consents] }));
        return con;
      },
      updateConsentScopes(id, scopes) {
        mutate((prev) => ({
          ...prev,
          consents: prev.consents.map((x) => (x.id === id ? { ...x, scopes } : x)),
        }));
      },
      revokeConsent(id) {
        mutate((prev) => ({
          ...prev,
          consents: prev.consents.map((x) =>
            x.id === id ? { ...x, status: "revoked", revokedAt: new Date().toISOString() } : x,
          ),
        }));
      },

      createThread(opts) {
        const now = new Date().toISOString();
        const thread: MessageThread = {
          id: newId("thr"),
          with: opts.with,
          withRole: opts.withRole,
          subject: opts.subject,
          unread: false,
          pinned: false,
          messages: [
            {
              id: newId("msg"),
              from: "patient",
              fromName: "You",
              body: opts.initialBody,
              at: now,
            },
          ],
          lastActivity: now,
        };
        mutate((prev) => ({ ...prev, threads: [thread, ...prev.threads] }));
        return thread;
      },
      sendMessage(threadId, body, attachments) {
        const now = new Date().toISOString();
        mutate((prev) => ({
          ...prev,
          threads: prev.threads.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: [
                    ...t.messages,
                    {
                      id: newId("msg"),
                      from: "patient",
                      fromName: "You",
                      body,
                      at: now,
                      attachments: attachments && attachments.length > 0 ? attachments : undefined,
                    },
                  ],
                  lastActivity: now,
                  unread: false,
                }
              : t,
          ),
        }));
      },
      markThreadRead(threadId) {
        mutate((prev) => ({
          ...prev,
          threads: prev.threads.map((t) =>
            t.id === threadId ? { ...t, unread: false } : t,
          ),
        }));
      },
      togglePinThread(threadId) {
        mutate((prev) => ({
          ...prev,
          threads: prev.threads.map((t) =>
            t.id === threadId ? { ...t, pinned: !t.pinned } : t,
          ),
        }));
      },

      markNotificationRead(id) {
        mutate((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        }));
      },
      markAllNotificationsRead() {
        mutate((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) => ({ ...n, read: true })),
        }));
      },
      addNotification(n) {
        const note: PatientNotification = {
          id: newId("ntf"),
          createdAt: new Date().toISOString(),
          read: false,
          ...n,
        };
        mutate((prev) => ({ ...prev, notifications: [note, ...prev.notifications] }));
      },

      updateProfile(patch) {
        mutate((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
      },

      setMfaEnabled(enabled) {
        mutate((prev) => ({
          ...prev,
          security: { ...prev.security, mfaEnabled: enabled },
        }));
      },
      revokeSession(id) {
        mutate((prev) => ({
          ...prev,
          security: {
            ...prev.security,
            sessions: prev.security.sessions.filter((s) => s.id !== id),
          },
        }));
      },

      addFamilyMember(p) {
        const member: FamilyMember = {
          ...p,
          id: newId("fam"),
          addedAt: new Date().toISOString(),
        };
        mutate((prev) => ({ ...prev, family: [member, ...prev.family] }));
        return member;
      },
      updateFamilyMember(id, patch) {
        mutate((prev) => ({
          ...prev,
          family: prev.family.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }));
      },
      removeFamilyMember(id) {
        mutate((prev) => ({ ...prev, family: prev.family.filter((m) => m.id !== id) }));
      },

      updateEmergencyContact(patch) {
        mutate((prev) => ({
          ...prev,
          emergencyContact: { ...prev.emergencyContact, ...patch, updatedAt: new Date().toISOString() },
        }));
      },

      addInsurancePlan(p) {
        const plan: InsurancePlan = {
          ...p,
          id: newId("ins"),
          addedAt: new Date().toISOString(),
        };
        mutate((prev) => {
          const next = [plan, ...prev.insurance];
          // If this is the first plan or marked primary, ensure isPrimary uniqueness.
          if (plan.isPrimary || next.length === 1) {
            return {
              ...prev,
              insurance: next.map((p, i) => ({ ...p, isPrimary: i === 0 })),
            };
          }
          return { ...prev, insurance: next };
        });
        return plan;
      },
      updateInsurancePlan(id, patch) {
        mutate((prev) => ({
          ...prev,
          insurance: prev.insurance.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }));
      },
      removeInsurancePlan(id) {
        mutate((prev) => {
          const next = prev.insurance.filter((p) => p.id !== id);
          // If we removed the primary, promote the first remaining plan.
          if (next.length > 0 && !next.some((p) => p.isPrimary)) {
            next[0] = { ...next[0], isPrimary: true };
          }
          return { ...prev, insurance: next };
        });
      },
      markPrimaryInsurance(id) {
        mutate((prev) => ({
          ...prev,
          insurance: prev.insurance.map((p) => ({ ...p, isPrimary: p.id === id })),
        }));
      },

      addVaccination(v) {
        const rec: VaccinationRecord = { ...v, id: newId("vac") };
        mutate((prev) => ({ ...prev, vaccinations: [rec, ...prev.vaccinations] }));
        return rec;
      },
      updateVaccination(id, patch) {
        mutate((prev) => ({
          ...prev,
          vaccinations: prev.vaccinations.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        }));
      },
      removeVaccination(id) {
        mutate((prev) => ({ ...prev, vaccinations: prev.vaccinations.filter((v) => v.id !== id) }));
      },

      resetDemo() {
        setState({ hydrated: true, ...makeSeed() });
      },
      clearDemo() {
        const seed = makeSeed();
        setState({
          hydrated: true,
          appointments: [],
          documents: [],
          consents: [],
          threads: [],
          notifications: [],
          profile: seed.profile,
          security: { mfaEnabled: false, sessions: seed.security.sessions.slice(0, 1) },
          family: [],
          emergencyContact: seed.emergencyContact,
          insurance: [],
          vaccinations: [],
        });
      },
    };
  }, []);

  const value = React.useMemo(() => ({ state, ...actions }), [state, actions]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePatientStore() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("usePatientStore must be used within PatientStoreProvider");
  return v;
}
