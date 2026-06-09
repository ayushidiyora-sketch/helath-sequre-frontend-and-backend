"use client";

import * as React from "react";

/* ============================================================================
 * Clinician portal local store
 *
 * Demo-only persistence for the Clinician's view: their assigned patients,
 * appointments with those patients, draft + finalized clinical notes &
 * prescriptions, schedule template + blocked slots, pending tasks,
 * notifications, and the clinician's own profile. Persists to localStorage
 * and rehydrates on first client render.
 * ========================================================================== */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConsentScope =
  | "lab"
  | "prescriptions"
  | "notes"
  | "imaging"
  | "mental_health"
  // Document-category scopes — match patient store + /patient/consents/grant
  // so the clinician's Consents tab can use the same six categories.
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

export interface AssignedPatient {
  id: string;
  mrn: string;
  name: string;
  initials: string;
  age: number;
  sex: "M" | "F" | "Other";
  email: string;
  phone: string;
  assignedAt: string;
  consentScopes: ConsentScope[];
  consentStatus: "active" | "revoked" | "pending";
  // Lightweight medical context for the pre-visit chart.
  conditions?: string[];
  allergies?: string[];
}

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

export type AppointmentMode = "in-person" | "telehealth";

export interface ClinicianAppointment {
  id: string;
  patientId: string;
  date: string; // yyyy-mm-dd
  time: string; // "10:00 AM"
  durationMinutes: number;
  mode: AppointmentMode;
  status: AppointmentStatus;
  reason: string;
  startedAt?: string;
  completedAt?: string;
}

export type NoteTemplate = "SOAP" | "Progress" | "Discharge" | "Consult";

export interface ClinicianNote {
  id: string;
  patientId: string;
  appointmentId?: string;
  template: NoteTemplate;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  body?: string;
  status: "draft" | "finalized";
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  version: number;
}

export interface Prescription {
  id: string;
  patientId: string;
  appointmentId?: string;
  medication: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  refills?: string;
  instructions?: string;
  status: "draft" | "finalized";
  createdAt: string;
  finalizedAt?: string;
}

export interface ClinicianDocument {
  id: string;
  patientId: string;
  name: string;
  category: "Lab Report" | "Imaging" | "Discharge" | "Other";
  sizeBytes: number;
  uploadedAt: string;
  uploaderName: string;
}

export type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export interface AvailabilityBlock {
  start: string; // "09:00"
  end: string;
}

export interface DayTemplate {
  morning?: AvailabilityBlock;
  afternoon?: AvailabilityBlock;
  slotMinutes: number;
  off: boolean;
}

export type ScheduleTemplate = Record<Weekday, DayTemplate>;

export interface BlockedSlot {
  id: string;
  date: string; // yyyy-mm-dd
  start: string;
  end: string;
  reason: string;
}

export type TaskType = "sign_note" | "approve_rx" | "reply_message" | "review_imaging";

export interface ClinicianTask {
  id: string;
  type: TaskType;
  title: string;
  subtitle: string;
  patientId?: string;
  urgent?: boolean;
  href?: string;
  createdAt: string;
  completedAt?: string;
}

export type ClinicianNotificationType = "assignment" | "task" | "consent" | "message" | "security";

export interface ClinicianNotification {
  id: string;
  type: ClinicianNotificationType;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface MessageDraft {
  id: string;
  patientId: string;
  body: string;
  savedAt: string;
}

export type AccessRequestStatus = "pending" | "approved" | "rejected" | "expired";

export interface AccessRequest {
  id: string;
  patientId: string;
  scopes: ConsentScope[];
  durationHours: number;
  reason: string;
  status: AccessRequestStatus;
  requestedAt: string;
  decidedAt?: string;
  expiresAt?: string;
  decisionNote?: string;
}

export interface ClinicianProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  specialization: string;
  licenseNumber: string;
  licenseExpiry: string;
}

export interface ClinicianState {
  hydrated: boolean;
  assignedPatients: AssignedPatient[];
  appointments: ClinicianAppointment[];
  notes: ClinicianNote[];
  prescriptions: Prescription[];
  documents: ClinicianDocument[];
  scheduleTemplate: ScheduleTemplate;
  blockedSlots: BlockedSlot[];
  tasks: ClinicianTask[];
  notifications: ClinicianNotification[];
  messageDrafts: MessageDraft[];
  accessRequests: AccessRequest[];
  profile: ClinicianProfile;
}

// ---------------------------------------------------------------------------
// Seed (empty — see comment in makeSeed)
// ---------------------------------------------------------------------------

function makeSeed(): Omit<ClinicianState, "hydrated"> {
  // No demo data. Every slice starts empty so a freshly-signed-in clinician
  // (Dr. Ayushi, Dr. Sharma, etc.) does NOT see Dr. Vikram Mehta's seeded
  // patients, appointments, notes, blocks, tasks, or notifications.
  //
  // - Assigned patients now come from real `PatientAssignment` rows via the
  //   /api/clinician/patients endpoint.
  // - Appointments will populate once /api/clinician/appointments lands.
  // - Profile identity is fetched from /api/clinician/dashboard on every load.
  //
  // The scheduleTemplate defaults to every day OFF so the patient booking
  // flow correctly reports "this clinician hasn't published availability yet"
  // until the clinician saves a real template via "Add availability".
  const offDay = { slotMinutes: 15, off: true } as const;
  return {
    assignedPatients: [],
    appointments: [],
    notes: [],
    prescriptions: [],
    documents: [],
    scheduleTemplate: {
      Monday: offDay,
      Tuesday: offDay,
      Wednesday: offDay,
      Thursday: offDay,
      Friday: offDay,
      Saturday: offDay,
      Sunday: offDay,
    },
    blockedSlots: [],
    tasks: [],
    notifications: [],
    messageDrafts: [],
    accessRequests: [],
    profile: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      department: "",
      specialization: "",
      licenseNumber: "",
      licenseExpiry: "",
    },
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

// Bumped v3 → v4 when all clinician seed data was stripped (2026-06-01).
// Returning clinicians with a v3 localStorage blob keep their seeded Vikram
// Mehta values otherwise; v4 ensures they reseed with the empty shape.
const STORAGE_KEY = "hs_clinician_store_v4";

function loadFromStorage(): Omit<ClinicianState, "hydrated"> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Omit<ClinicianState, "hydrated">;
  } catch {
    return null;
  }
}

function saveToStorage(state: Omit<ClinicianState, "hydrated">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

interface StoreActions {
  // appointments / encounter lifecycle
  setAppointmentStatus(id: string, status: AppointmentStatus): void;
  rescheduleAppointment(id: string, date: string, time: string): void;
  // notes
  addNote(n: Omit<ClinicianNote, "id" | "createdAt" | "updatedAt" | "status" | "version">): ClinicianNote;
  updateNote(id: string, patch: Partial<Omit<ClinicianNote, "id">>): void;
  finalizeNote(id: string): void;
  // prescriptions
  addPrescription(rx: Omit<Prescription, "id" | "createdAt" | "status">): Prescription;
  updatePrescription(id: string, patch: Partial<Omit<Prescription, "id" | "patientId" | "createdAt" | "status">>): void;
  finalizePrescription(id: string): void;
  // documents
  uploadDocument(d: Omit<ClinicianDocument, "id" | "uploadedAt">): ClinicianDocument;
  // schedule
  updateDayTemplate(day: Weekday, patch: Partial<DayTemplate>): void;
  addBlockedSlot(b: Omit<BlockedSlot, "id">): BlockedSlot;
  removeBlockedSlot(id: string): void;
  // tasks
  completeTask(id: string): void;
  addTask(t: Omit<ClinicianTask, "id" | "createdAt">): void;
  // notifications
  markNotificationRead(id: string): void;
  markAllNotificationsRead(): void;
  addNotification(n: Omit<ClinicianNotification, "id" | "createdAt" | "read">): void;
  // message drafts
  saveDraft(patientId: string, body: string): MessageDraft;
  deleteDraft(id: string): void;
  // consent simulation (for the access-denied flow)
  toggleConsent(patientId: string, scope: ConsentScope): void;
  // sensitive-access approval workflow (UI walkthrough)
  requestAccess(p: { patientId: string; scopes: ConsentScope[]; durationHours: number; reason: string }): AccessRequest;
  simulateApprovalDecision(id: string, decision: "approve" | "reject", note?: string): void;
  /** Apply a server-side decision to a local request (used by chart-page polling). */
  reconcileRemoteRequest(p: {
    id: string;
    patientId: string;
    scopes: ConsentScope[];
    durationHours: number;
    reason: string;
    status: string;
    requestedAt: string;
    decidedAt: string | null;
    expiresAt: string | null;
  }): void;
  revokeExpiredAccess(): void;
  // profile
  updateProfile(patch: Partial<ClinicianProfile>): void;
  // demo
  resetDemo(): void;
}

const Ctx = React.createContext<({ state: ClinicianState } & StoreActions) | null>(null);

export function ClinicianStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ClinicianState>(() => ({
    hydrated: false,
    ...makeSeed(),
  }));

  React.useEffect(() => {
    const stored = loadFromStorage();
    const seeded = stored ?? makeSeed();
    // Backfill accessRequests for stores persisted before this slice existed.
    const hydrated: ClinicianState = {
      hydrated: true,
      ...seeded,
      accessRequests: seeded.accessRequests ?? [],
    };
    // Expire-on-load sweep so the green banner disappears on its own.
    const now = Date.now();
    hydrated.accessRequests = hydrated.accessRequests.map((r) =>
      r.status === "approved" && r.expiresAt && Date.parse(r.expiresAt) <= now
        ? { ...r, status: "expired" as const }
        : r,
    );
    setState(hydrated);
  }, []);

  React.useEffect(() => {
    if (!state.hydrated) return;
    const tick = () => {
      setState((prev) => {
        const now = Date.now();
        let changed = false;
        const next = prev.accessRequests.map((r) => {
          if (r.status === "approved" && r.expiresAt && Date.parse(r.expiresAt) <= now) {
            changed = true;
            return { ...r, status: "expired" as const };
          }
          return r;
        });
        return changed ? { ...prev, accessRequests: next } : prev;
      });
    };
    const handle = window.setInterval(tick, 30_000);
    return () => window.clearInterval(handle);
  }, [state.hydrated]);

  React.useEffect(() => {
    if (!state.hydrated) return;
    const { hydrated: _h, ...persistable } = state;
    void _h;
    saveToStorage(persistable);
  }, [state]);

  const actions = React.useMemo<StoreActions>(() => {
    const mutate = (fn: (prev: ClinicianState) => ClinicianState) => setState(fn);
    return {
      setAppointmentStatus(id, status) {
        mutate((prev) => ({
          ...prev,
          appointments: prev.appointments.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status,
                  startedAt: status === "in-progress" && !a.startedAt ? new Date().toISOString() : a.startedAt,
                  completedAt: status === "completed" ? new Date().toISOString() : a.completedAt,
                }
              : a,
          ),
        }));
      },
      rescheduleAppointment(id, date, time) {
        mutate((prev) => ({
          ...prev,
          appointments: prev.appointments.map((a) =>
            a.id === id ? { ...a, date, time, status: "confirmed" } : a,
          ),
        }));
      },

      addNote(n) {
        const now = new Date().toISOString();
        const note: ClinicianNote = {
          ...n,
          id: newId("note"),
          status: "draft",
          createdAt: now,
          updatedAt: now,
          version: 1,
        };
        mutate((prev) => ({ ...prev, notes: [note, ...prev.notes] }));
        return note;
      },
      updateNote(id, patch) {
        mutate((prev) => ({
          ...prev,
          notes: prev.notes.map((n) =>
            n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n,
          ),
        }));
      },
      finalizeNote(id) {
        mutate((prev) => ({
          ...prev,
          notes: prev.notes.map((n) =>
            n.id === id
              ? { ...n, status: "finalized", finalizedAt: new Date().toISOString() }
              : n,
          ),
          tasks: prev.tasks.map((t) =>
            t.type === "sign_note" && t.subtitle.includes(prev.notes.find((n) => n.id === id)?.patientId ?? "")
              ? { ...t, completedAt: new Date().toISOString() }
              : t,
          ),
        }));
      },

      addPrescription(rx) {
        const prescription: Prescription = {
          ...rx,
          id: newId("rx"),
          status: "draft",
          createdAt: new Date().toISOString(),
        };
        mutate((prev) => ({ ...prev, prescriptions: [prescription, ...prev.prescriptions] }));
        return prescription;
      },
      updatePrescription(id, patch) {
        mutate((prev) => ({
          ...prev,
          prescriptions: prev.prescriptions.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }));
      },
      finalizePrescription(id) {
        mutate((prev) => ({
          ...prev,
          prescriptions: prev.prescriptions.map((p) =>
            p.id === id
              ? { ...p, status: "finalized", finalizedAt: new Date().toISOString() }
              : p,
          ),
        }));
      },

      uploadDocument(d) {
        const doc: ClinicianDocument = {
          ...d,
          id: newId("doc"),
          uploadedAt: new Date().toISOString(),
        };
        mutate((prev) => ({ ...prev, documents: [doc, ...prev.documents] }));
        return doc;
      },

      updateDayTemplate(day, patch) {
        mutate((prev) => ({
          ...prev,
          scheduleTemplate: { ...prev.scheduleTemplate, [day]: { ...prev.scheduleTemplate[day], ...patch } },
        }));
      },
      addBlockedSlot(b) {
        const slot: BlockedSlot = { ...b, id: newId("blk") };
        mutate((prev) => ({ ...prev, blockedSlots: [slot, ...prev.blockedSlots] }));
        return slot;
      },
      removeBlockedSlot(id) {
        mutate((prev) => ({ ...prev, blockedSlots: prev.blockedSlots.filter((s) => s.id !== id) }));
      },

      completeTask(id) {
        mutate((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === id ? { ...t, completedAt: new Date().toISOString() } : t,
          ),
        }));
      },
      addTask(t) {
        const task: ClinicianTask = { ...t, id: newId("task"), createdAt: new Date().toISOString() };
        mutate((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
      },

      markNotificationRead(id) {
        mutate((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        }));
      },
      markAllNotificationsRead() {
        mutate((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) => ({ ...n, read: true })),
        }));
      },
      addNotification(n) {
        const note: ClinicianNotification = {
          ...n,
          id: newId("ntf"),
          read: false,
          createdAt: new Date().toISOString(),
        };
        mutate((prev) => ({ ...prev, notifications: [note, ...prev.notifications] }));
      },

      saveDraft(patientId, body) {
        const draft: MessageDraft = {
          id: newId("msd"),
          patientId,
          body,
          savedAt: new Date().toISOString(),
        };
        mutate((prev) => ({ ...prev, messageDrafts: [draft, ...prev.messageDrafts] }));
        return draft;
      },
      deleteDraft(id) {
        mutate((prev) => ({ ...prev, messageDrafts: prev.messageDrafts.filter((d) => d.id !== id) }));
      },

      toggleConsent(patientId, scope) {
        mutate((prev) => ({
          ...prev,
          assignedPatients: prev.assignedPatients.map((p) =>
            p.id === patientId
              ? {
                  ...p,
                  consentScopes: p.consentScopes.includes(scope)
                    ? p.consentScopes.filter((s) => s !== scope)
                    : [...p.consentScopes, scope],
                }
              : p,
          ),
        }));
      },

      requestAccess({ patientId, scopes, durationHours, reason }) {
        const req: AccessRequest = {
          id: newId("ar"),
          patientId,
          scopes,
          durationHours,
          reason,
          status: "pending",
          requestedAt: new Date().toISOString(),
        };
        mutate((prev) => ({ ...prev, accessRequests: [req, ...prev.accessRequests] }));
        return req;
      },
      simulateApprovalDecision(id, decision, note) {
        mutate((prev) => {
          const target = prev.accessRequests.find((r) => r.id === id);
          const now = new Date();
          const accessRequests = prev.accessRequests.map((r) => {
            if (r.id !== id) return r;
            if (decision === "approve") {
              const expiresAt = new Date(now.getTime() + r.durationHours * 60 * 60 * 1000).toISOString();
              return {
                ...r,
                status: "approved" as const,
                decidedAt: now.toISOString(),
                expiresAt,
                decisionNote: note,
              };
            }
            return {
              ...r,
              status: "rejected" as const,
              decidedAt: now.toISOString(),
              decisionNote: note,
            };
          });
          // When the simulated decision is approve, flip every scope the
          // request asked for into the patient's consentScopes so the 6
          // Consents-tab cards mirror the green top-banner — otherwise the
          // chart shows "Approved" up top but the scope cards stay red.
          let assignedPatients = prev.assignedPatients;
          if (decision === "approve" && target) {
            assignedPatients = prev.assignedPatients.map((p) => {
              if (p.id !== target.patientId) return p;
              const merged = Array.from(new Set([...p.consentScopes, ...target.scopes]));
              return { ...p, consentScopes: merged, consentStatus: "active" as const };
            });
          }
          return { ...prev, accessRequests, assignedPatients };
        });
      },
      reconcileRemoteRequest(p) {
        // Map server status → local AccessRequest.status enum.
        const localStatus: AccessRequest["status"] =
          p.status === "approved"
            ? "approved"
            : p.status === "declined" || p.status === "rejected"
              ? "rejected"
              : p.status === "expired"
                ? "expired"
                : "pending";
        mutate((prev) => {
          const existing = prev.accessRequests.find((r) => r.id === p.id);
          const next: AccessRequest = existing
            ? { ...existing, status: localStatus, decidedAt: p.decidedAt ?? existing.decidedAt, expiresAt: p.expiresAt ?? existing.expiresAt }
            : {
                id: p.id,
                patientId: p.patientId,
                scopes: p.scopes,
                durationHours: p.durationHours,
                reason: p.reason,
                status: localStatus,
                requestedAt: p.requestedAt,
                decidedAt: p.decidedAt ?? undefined,
                expiresAt: p.expiresAt ?? undefined,
              };
          const accessRequests = existing
            ? prev.accessRequests.map((r) => (r.id === p.id ? next : r))
            : [next, ...prev.accessRequests];
          // On approval, mirror request scopes into the patient's standing
          // consent so the 6 Consents-tab cards flip green even after refresh.
          let assignedPatients = prev.assignedPatients;
          if (localStatus === "approved") {
            assignedPatients = prev.assignedPatients.map((pat) => {
              if (pat.id !== p.patientId) return pat;
              const merged = Array.from(new Set([...pat.consentScopes, ...p.scopes]));
              return { ...pat, consentScopes: merged, consentStatus: "active" as const };
            });
          }
          return { ...prev, accessRequests, assignedPatients };
        });
      },
      revokeExpiredAccess() {
        const now = Date.now();
        mutate((prev) => {
          let changed = false;
          const next = prev.accessRequests.map((r) => {
            if (r.status === "approved" && r.expiresAt && Date.parse(r.expiresAt) <= now) {
              changed = true;
              return { ...r, status: "expired" as const };
            }
            return r;
          });
          return changed ? { ...prev, accessRequests: next } : prev;
        });
      },

      updateProfile(patch) {
        mutate((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
      },

      resetDemo() {
        setState({ hydrated: true, ...makeSeed() });
      },
    };
  }, []);

  const value = React.useMemo(() => ({ state, ...actions }), [state, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClinicianStore() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useClinicianStore must be used within ClinicianStoreProvider");
  return v;
}

// ---------------------------------------------------------------------------
// Helpers exported for consumers
// ---------------------------------------------------------------------------

export function patientHasConsent(p: AssignedPatient, scope: ConsentScope): boolean {
  return p.consentStatus === "active" && p.consentScopes.includes(scope);
}

export function hasEffectiveConsent(
  state: Pick<ClinicianState, "assignedPatients" | "accessRequests">,
  patientId: string,
  scope: ConsentScope,
): boolean {
  const patient = state.assignedPatients.find((p) => p.id === patientId);
  if (patient && patientHasConsent(patient, scope)) return true;
  const now = Date.now();
  return state.accessRequests.some(
    (r) =>
      r.patientId === patientId &&
      r.status === "approved" &&
      r.scopes.includes(scope) &&
      r.expiresAt !== undefined &&
      Date.parse(r.expiresAt) > now,
  );
}

export function activeApprovedRequest(
  state: Pick<ClinicianState, "accessRequests">,
  patientId: string,
): AccessRequest | undefined {
  const now = Date.now();
  return state.accessRequests.find(
    (r) =>
      r.patientId === patientId &&
      r.status === "approved" &&
      r.expiresAt !== undefined &&
      Date.parse(r.expiresAt) > now,
  );
}

export function pendingRequest(
  state: Pick<ClinicianState, "accessRequests">,
  patientId: string,
  /** When given, only matches a pending request that covers this scope, so each
   *  category tab can show its own Request-access button independently. */
  scope?: ConsentScope,
): AccessRequest | undefined {
  return state.accessRequests.find(
    (r) =>
      r.patientId === patientId &&
      r.status === "pending" &&
      (scope ? r.scopes.includes(scope) : true),
  );
}
