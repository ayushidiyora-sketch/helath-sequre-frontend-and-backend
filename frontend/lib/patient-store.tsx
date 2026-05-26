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

export interface Message {
  id: string;
  from: "patient" | "clinician";
  fromName: string;
  body: string;
  at: string;
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
}

export interface Security {
  mfaEnabled: boolean;
  sessions: Session[];
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
          lastSeen: new Date().toISOString(),
          current: true,
        },
        {
          id: "ses-2",
          device: "Safari · iPhone 14",
          location: "Ahmedabad, IN",
          lastSeen: isoDaysFromNow(-3, 21, 0),
          current: false,
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const STORAGE_KEY = "hs_patient_store_v1";

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
  sendMessage(threadId: string, body: string): void;
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
      sendMessage(threadId, body) {
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
