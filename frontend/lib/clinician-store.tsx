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

export type ConsentScope = "lab" | "prescriptions" | "notes" | "imaging" | "mental_health";

export const CONSENT_SCOPE_LABEL: Record<ConsentScope, string> = {
  lab: "Lab Reports",
  prescriptions: "Prescriptions",
  notes: "Clinical Notes",
  imaging: "Imaging",
  mental_health: "Mental Health",
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
  | "confirmed"
  | "arrived"
  | "in-progress"
  | "completed"
  | "cancelled"
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
// Seed
// ---------------------------------------------------------------------------

function iso(days: number, hour = 9, min = 0): string {
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

function makeSeed(): Omit<ClinicianState, "hydrated"> {
  const today = dateOnly(0);
  const yesterday = dateOnly(-1);
  const tomorrow = dateOnly(1);
  const dayAfter = dateOnly(2);
  const seededExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  return {
    assignedPatients: [
      {
        id: "pt_ramesh",
        mrn: "CITY-001234",
        name: "Ramesh Patel",
        initials: "RP",
        age: 45,
        sex: "M",
        email: "ramesh@gmail.com",
        phone: "+91 98201 11111",
        assignedAt: iso(-3),
        consentScopes: ["lab", "prescriptions", "notes", "imaging"],
        consentStatus: "active",
        conditions: ["Hypertension", "Family history of CAD"],
        allergies: ["None known"],
      },
      {
        id: "pt_suresh",
        mrn: "CITY-001235",
        name: "Suresh Mehta",
        initials: "SM",
        age: 52,
        sex: "M",
        email: "suresh@yahoo.com",
        phone: "+91 98201 22222",
        assignedAt: iso(-3),
        consentScopes: ["lab", "prescriptions", "notes"],
        consentStatus: "active",
        conditions: ["Stage 1 Hypertension"],
        allergies: ["Sulfa drugs"],
      },
      {
        id: "pt_kavita",
        mrn: "CITY-001236",
        name: "Kavita Shah",
        initials: "KS",
        age: 38,
        sex: "F",
        email: "kavita@gmail.com",
        phone: "+91 98201 33333",
        assignedAt: iso(-3),
        consentScopes: ["lab", "prescriptions", "notes", "imaging"],
        consentStatus: "active",
        conditions: ["Paroxysmal atrial fibrillation"],
        allergies: ["Penicillin"],
      },
    ],
    appointments: [
      {
        id: "apt_today_ramesh",
        patientId: "pt_ramesh",
        date: today,
        time: "10:00 AM",
        durationMinutes: 30,
        mode: "in-person",
        status: "confirmed",
        reason: "Chest pain — first consult",
      },
      {
        id: "apt_today_suresh",
        patientId: "pt_suresh",
        date: today,
        time: "11:30 AM",
        durationMinutes: 30,
        mode: "in-person",
        status: "confirmed",
        reason: "BP follow-up",
      },
      {
        id: "apt_today_kavita",
        patientId: "pt_kavita",
        date: today,
        time: "2:00 PM",
        durationMinutes: 30,
        mode: "telehealth",
        status: "confirmed",
        reason: "Arrhythmia review",
      },
      // Yesterday — completed encounters
      {
        id: "apt_y_suresh",
        patientId: "pt_suresh",
        date: yesterday,
        time: "9:30 AM",
        durationMinutes: 20,
        mode: "in-person",
        status: "completed",
        reason: "Post-op review",
      },
      {
        id: "apt_y_kavita",
        patientId: "pt_kavita",
        date: yesterday,
        time: "11:00 AM",
        durationMinutes: 30,
        mode: "telehealth",
        status: "no-show",
        reason: "Medication titration",
      },
      // Tomorrow
      {
        id: "apt_tmrw_ramesh",
        patientId: "pt_ramesh",
        date: tomorrow,
        time: "9:00 AM",
        durationMinutes: 30,
        mode: "in-person",
        status: "confirmed",
        reason: "ECG review · follow-up",
      },
      {
        id: "apt_tmrw_suresh",
        patientId: "pt_suresh",
        date: tomorrow,
        time: "10:30 AM",
        durationMinutes: 20,
        mode: "in-person",
        status: "requested",
        reason: "Stress test results",
      },
      {
        id: "apt_tmrw_kavita",
        patientId: "pt_kavita",
        date: tomorrow,
        time: "3:30 PM",
        durationMinutes: 30,
        mode: "telehealth",
        status: "confirmed",
        reason: "Holter monitor debrief",
      },
      // Day after tomorrow
      {
        id: "apt_d2_ramesh",
        patientId: "pt_ramesh",
        date: dayAfter,
        time: "10:00 AM",
        durationMinutes: 45,
        mode: "in-person",
        status: "confirmed",
        reason: "New patient · referral from PCP",
      },
      {
        id: "apt_d2_kavita",
        patientId: "pt_kavita",
        date: dayAfter,
        time: "1:30 PM",
        durationMinutes: 20,
        mode: "telehealth",
        status: "requested",
        reason: "Quick check-in",
      },
    ],
    notes: [
      {
        id: "note_seed_1",
        patientId: "pt_suresh",
        template: "SOAP",
        subjective: "Patient reports BP under control on current regimen.",
        objective: "BP 128/82 · HR 72.",
        assessment: "Hypertension well controlled.",
        plan: "Continue current dose. Recheck in 3 months.",
        status: "finalized",
        createdAt: iso(-7),
        updatedAt: iso(-7),
        finalizedAt: iso(-7, 14, 0),
        version: 1,
      },
    ],
    prescriptions: [],
    documents: [
      {
        id: "doc_ramesh_ecg",
        patientId: "pt_ramesh",
        name: "Previous ECG report.pdf",
        category: "Lab Report",
        sizeBytes: 124_300,
        uploadedAt: iso(-3),
        uploaderName: "Patient self-upload",
      },
    ],
    scheduleTemplate: {
      Monday: { morning: { start: "09:00", end: "13:00" }, afternoon: { start: "14:00", end: "17:00" }, slotMinutes: 30, off: false },
      Tuesday: { morning: { start: "09:00", end: "13:00" }, afternoon: { start: "14:00", end: "17:00" }, slotMinutes: 30, off: false },
      Wednesday: { morning: { start: "09:00", end: "13:00" }, afternoon: { start: "14:00", end: "17:00" }, slotMinutes: 30, off: false },
      Thursday: { morning: { start: "09:00", end: "13:00" }, slotMinutes: 30, off: false },
      Friday: { morning: { start: "09:00", end: "13:00" }, afternoon: { start: "14:00", end: "17:00" }, slotMinutes: 30, off: false },
      Saturday: { morning: { start: "10:00", end: "13:00" }, slotMinutes: 30, off: false },
      Sunday: { slotMinutes: 30, off: true },
    },
    blockedSlots: [
      { id: "blk_today_lunch", date: today, start: "13:00", end: "14:00", reason: "Lunch" },
      { id: "blk_tmrw_admin", date: tomorrow, start: "12:00", end: "13:00", reason: "Admin time" },
      { id: "blk_d2_focus", date: dayAfter, start: "15:00", end: "16:00", reason: "Focus block · charting" },
    ],
    tasks: [
      {
        id: "task_seed_1",
        type: "sign_note",
        title: "Sign off SOAP — Suresh Mehta",
        subtitle: "Drafted yesterday",
        patientId: "pt_suresh",
        href: "/clinician/notes",
        createdAt: iso(-1),
      },
      {
        id: "task_seed_2",
        type: "review_imaging",
        title: "Review Chest X-ray — Ramesh Patel",
        subtitle: "Uploaded 2h ago",
        patientId: "pt_ramesh",
        urgent: true,
        href: "/clinician/patients/pt_ramesh",
        createdAt: iso(-1),
      },
    ],
    notifications: [
      {
        id: "ntf_assign",
        type: "assignment",
        title: "3 new patients assigned",
        body: "Ramesh Patel, Suresh Mehta, Kavita Shah — by Maya Iyer (Org Admin)",
        href: "/clinician/patients",
        read: false,
        createdAt: iso(-1, 14, 0),
      },
    ],
    messageDrafts: [],
    accessRequests: [
      {
        id: "ar_seed_kavita",
        patientId: "pt_kavita",
        scopes: ["notes", "lab", "prescriptions", "imaging"],
        durationHours: 24,
        reason: "Approved on-call review of Kavita's arrhythmia history.",
        status: "approved",
        requestedAt: iso(-1, 8, 0),
        decidedAt: iso(-1, 9, 30),
        expiresAt: seededExpiresAt,
        decisionNote: "Approved by Sai — narrow to review only, no edits.",
      },
    ],
    profile: {
      firstName: "Vikram",
      lastName: "Mehta",
      email: "dr.mehta@cityhospital.com",
      phone: "+91 98200 12345",
      department: "Cardiology",
      specialization: "Interventional Cardiology",
      licenseNumber: "GUJ-MED-12345",
      licenseExpiry: "2028-12-31",
    },
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const STORAGE_KEY = "hs_clinician_store_v3";

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
        mutate((prev) => ({
          ...prev,
          accessRequests: prev.accessRequests.map((r) => {
            if (r.id !== id) return r;
            const now = new Date();
            if (decision === "approve") {
              const expiresAt = new Date(now.getTime() + r.durationHours * 60 * 60 * 1000).toISOString();
              return {
                ...r,
                status: "approved",
                decidedAt: now.toISOString(),
                expiresAt,
                decisionNote: note,
              };
            }
            return {
              ...r,
              status: "rejected",
              decidedAt: now.toISOString(),
              decisionNote: note,
            };
          }),
        }));
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
): AccessRequest | undefined {
  return state.accessRequests.find((r) => r.patientId === patientId && r.status === "pending");
}
