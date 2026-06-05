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
  | "reschedule-requested"
  | "confirmed"
  | "arrived"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "rejected"
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
  /** Base64 data URL of the uploaded file. Empty for seeded demo docs.
   *  Used for in-browser preview (new tab) and real-bytes download. */
  dataUrl?: string;
  /** MIME type captured from the File object on upload. Drives the preview
   *  behaviour (PDFs/images render inline; other types still download). */
  mimeType?: string;
}

export type ConsentScope =
  | "lab"
  | "prescriptions"
  | "notes"
  | "imaging"
  | "mental_health"
  // Document-category scopes — these match the tags on the patient's
  // Documents page (Insurance, ID Proof, Other) so the grant UI can be
  // category-driven instead of generic PHI-access-driven.
  | "insurance"
  | "id_proof"
  | "other";

export const CONSENT_SCOPE_LABEL: Record<ConsentScope, string> = {
  lab: "Lab Report",
  prescriptions: "Prescription",
  notes: "Clinical Notes",
  imaging: "Imaging",
  mental_health: "Mental Health",
  insurance: "Insurance",
  id_proof: "ID Proof",
  other: "Other",
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
// Seed (empty — see comment in makeSeed)
// ---------------------------------------------------------------------------

function makeSeed(): Omit<PatientState, "hydrated"> {
  // No demo data. Every slice starts empty so a freshly-signed-in patient
  // (Tarun, Ayushi, etc.) does NOT see Aarav Mehta's appointments, records,
  // family, insurance, etc. The Profile slice is intentionally empty because
  // patient identity now comes from /api/patient/profile on every render.
  return {
    appointments: [],
    documents: [],
    consents: [],
    threads: [],
    notifications: [],
    profile: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dob: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
    },
    security: {
      mfaEnabled: false,
      sessions: [],
    },
    family: [],
    emergencyContact: {
      primaryName: "",
      primaryRelationship: "",
      primaryPhone: "",
      secondaryName: "",
      secondaryRelationship: "",
      secondaryPhone: "",
      bloodGroup: "Unknown",
      allergies: [],
      criticalMedications: [],
      medicalIds: [],
      organDonor: false,
      preferredHospital: "",
      updatedAt: new Date().toISOString(),
    },
    insurance: [],
    vaccinations: [],
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

// Bumped v2 → v3 when all seed data was stripped (2026-06-01). Returning
// patients with a v2 localStorage blob keep their seeded Aarav-Mehta values
// otherwise; v3 ensures they reseed with the empty shape.
const STORAGE_KEY = "hs_patient_store_v3";

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
  addDocument(d: Omit<PatientDocument, "id" | "uploadedAt" | "uploadedBy" | "scanStatus"> & { uploadedBy?: PatientDocument["uploadedBy"]; scanStatus?: DocumentScanStatus }): PatientDocument;
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
        // Caller may supply an explicit scanStatus from the real client-side
        // scanner (lib/document-scanner.ts). When omitted, the row enters as
        // `pending_scan` and the upload caller is expected to flip it to
        // clean/infected as soon as its scan settles — we no longer auto-
        // promote to "clean" after a 1.5s timer, because that ignored the
        // actual file bytes and showed Clean on infected uploads too.
        const doc: PatientDocument = {
          id: newId("doc"),
          uploadedAt: new Date().toISOString(),
          uploadedBy: d.uploadedBy ?? "patient",
          ...d,
          // Must come AFTER the spread so an explicit scanStatus on `d`
          // (passed by the upload caller after running document-scanner)
          // wins, but undefined falls back to pending_scan.
          scanStatus: d.scanStatus ?? "pending_scan",
        };
        mutate((prev) => ({ ...prev, documents: [doc, ...prev.documents] }));
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
