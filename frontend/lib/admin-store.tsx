"use client";

import * as React from "react";

/* ============================================================================
 * Org Admin portal local store
 *
 * Demo-only persistence for the Org Admin's view: tenant + org profile +
 * retention/branding policy, department hierarchy, staff with invitation
 * status, patients with invitation status, patient↔clinician assignments
 * (with consent gate), notification templates, admin-side notifications,
 * onboarding checklist. Mirrors patient-store and clinician-store.
 * ========================================================================== */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StaffRole = "Org Admin" | "Compliance Manager" | "Auditor" | "Clinician" | "Care Team";
export type InvitationStatus = "pending" | "accepted" | "expired" | "bounced";
export type LicenseStatus = "pending_verification" | "verified" | "rejected";
export type ActiveStatus = "active" | "deactivated" | "under_investigation";

export interface OrgProfile {
  name: string;
  type: "Hospital" | "Clinic" | "Telemedicine" | "Diagnostic";
  phone: string;
  email: string;
  address: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface RetentionPolicy {
  medicalRecordsYears: number;
  documentsYears: number;
  messagesYears: number;
  notificationsMonths: number;
  clinicalStaffSessionMinutes: number;
  patientSessionMinutes: number;
  passwordMinLength: number;
  passwordReuseHistory: number;
}

export interface Channels {
  smsEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

export interface SchedulePolicy {
  defaultSlotMinutes: number;
  bufferMinutes: number;
  rescheduleWindowHours: number;
  cancellationWindowHours: number;
  reminderT24h: boolean;
  reminderT1h: boolean;
  reminderT15m: boolean;
  autoConfirmBookings: boolean;
}

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  description?: string;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  department?: string;
  specialization?: string;
  licenseNumber?: string;
  licenseStatus?: LicenseStatus;
  invitationStatus: InvitationStatus;
  invitedAt: string;
  acceptedAt?: string;
  lastLoginAt?: string;
  status: ActiveStatus;
}

export interface AdminPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  age: number;
  sex: "M" | "F" | "Other";
  invitationStatus: InvitationStatus;
  status: ActiveStatus;
  registeredAt: string;
}

export type AssignmentStatus = "pending_consent" | "active" | "revoked" | "transferred";

export interface Assignment {
  id: string;
  patientId: string;
  clinicianId: string;
  status: AssignmentStatus;
  createdAt: string;
  consentedAt?: string;
  reason?: string;
}

export type TemplateType =
  | "appointment_reminder_t24h"
  | "appointment_reminder_t1h"
  | "appointment_confirmed"
  | "appointment_rescheduled"
  | "appointment_cancelled"
  | "new_message"
  | "new_record"
  | "consent_request"
  | "consent_revoked"
  | "password_reset"
  | "mfa_setup"
  | "new_device"
  | "suspicious_activity"
  | "custom";

export type TemplateChannel = "email" | "sms" | "in_app";

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  subject: string;
  body: string;
  channels: TemplateChannel[];
  active: boolean;
  version: string;
  updatedAt: string;
}

export type AdminNotificationType = "invitation" | "consent" | "security" | "system" | "report";

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface OnboardingChecklist {
  orgProfileComplete: boolean;
  departmentsCreated: boolean;
  complianceManagerInvited: boolean;
  firstStaffInvited: boolean;
  firstPatientInvited: boolean;
  templatesConfigured: boolean;
  schedulePolicySet: boolean;
}

export interface AuditEvent {
  id: string;
  type: string; // e.g., "department.create", "user.deactivate"
  actor: string;
  subject?: string;
  description: string;
  at: string;
}

export interface AdminState {
  hydrated: boolean;
  tenantName: string;
  orgProfile: OrgProfile;
  retention: RetentionPolicy;
  channels: Channels;
  schedule: SchedulePolicy;
  departments: Department[];
  staff: StaffMember[];
  patients: AdminPatient[];
  assignments: Assignment[];
  templates: Template[];
  notifications: AdminNotification[];
  onboarding: OnboardingChecklist;
  audit: AuditEvent[];
  consentPolicyVersion: string;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function isoAgo(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function makeSeed(): Omit<AdminState, "hydrated"> {
  return {
    tenantName: "City General Hospital",
    orgProfile: {
      name: "City General Hospital",
      type: "Hospital",
      phone: "+91 79 4567 8910",
      email: "info@citygeneral.health",
      address: "Plot 14, Sky Road, Ahmedabad 380015",
      primaryColor: "#0E7490",
      secondaryColor: "#FFFFFF",
    },
    retention: {
      medicalRecordsYears: 7,
      documentsYears: 5,
      messagesYears: 2,
      notificationsMonths: 6,
      clinicalStaffSessionMinutes: 15,
      patientSessionMinutes: 30,
      passwordMinLength: 12,
      passwordReuseHistory: 5,
    },
    channels: { smsEnabled: true, emailEnabled: true, inAppEnabled: true },
    schedule: {
      defaultSlotMinutes: 30,
      bufferMinutes: 5,
      rescheduleWindowHours: 24,
      cancellationWindowHours: 24,
      reminderT24h: true,
      reminderT1h: true,
      reminderT15m: false,
      autoConfirmBookings: true,
    },
    departments: [
      { id: "dpt_medicine", name: "Medicine", parentId: null, createdAt: isoAgo(20) },
      { id: "dpt_cardiology", name: "Cardiology", parentId: "dpt_medicine", createdAt: isoAgo(20) },
      { id: "dpt_general_med", name: "General Medicine", parentId: "dpt_medicine", createdAt: isoAgo(20) },
      { id: "dpt_pediatrics", name: "Pediatrics", parentId: "dpt_medicine", createdAt: isoAgo(20) },
      { id: "dpt_surgery", name: "Surgery", parentId: null, createdAt: isoAgo(20) },
      { id: "dpt_general_surg", name: "General Surgery", parentId: "dpt_surgery", createdAt: isoAgo(20) },
      { id: "dpt_orthopedics", name: "Orthopedics", parentId: "dpt_surgery", createdAt: isoAgo(20) },
      { id: "dpt_diagnostics", name: "Diagnostics", parentId: null, createdAt: isoAgo(20) },
      { id: "dpt_radiology", name: "Radiology", parentId: "dpt_diagnostics", createdAt: isoAgo(20) },
      { id: "dpt_pathology", name: "Pathology", parentId: "dpt_diagnostics", createdAt: isoAgo(20) },
      { id: "dpt_opd", name: "OPD", parentId: null, createdAt: isoAgo(20) },
    ],
    staff: [
      {
        id: "stf_priya",
        email: "priya.shah@citygeneral.health",
        firstName: "Priya",
        lastName: "Shah",
        role: "Clinician",
        department: "Cardiology",
        specialization: "Interventional Cardiology",
        licenseNumber: "MCI-MH-58921",
        licenseStatus: "verified",
        invitationStatus: "accepted",
        invitedAt: isoAgo(18),
        acceptedAt: isoAgo(17),
        lastLoginAt: isoAgo(0, 9),
        status: "active",
      },
      {
        id: "stf_rohan",
        email: "rohan.iyer@citygeneral.health",
        firstName: "Rohan",
        lastName: "Iyer",
        role: "Clinician",
        department: "General Medicine",
        specialization: "General Physician",
        licenseNumber: "MCI-MH-49123",
        licenseStatus: "verified",
        invitationStatus: "accepted",
        invitedAt: isoAgo(18),
        acceptedAt: isoAgo(16),
        lastLoginAt: isoAgo(1, 18),
        status: "active",
      },
      {
        id: "stf_desai",
        email: "compliance@citygeneral.health",
        firstName: "Anjali",
        lastName: "Desai",
        role: "Compliance Manager",
        invitationStatus: "accepted",
        invitedAt: isoAgo(20),
        acceptedAt: isoAgo(19),
        lastLoginAt: isoAgo(0, 11),
        status: "active",
      },
      {
        id: "stf_pending_doctor",
        email: "dr.joshi@citygeneral.health",
        firstName: "Pradeep",
        lastName: "Joshi",
        role: "Clinician",
        department: "Neurology",
        specialization: "Neurologist",
        licenseNumber: "MCI-MH-77234",
        licenseStatus: "pending_verification",
        invitationStatus: "accepted",
        invitedAt: isoAgo(3),
        acceptedAt: isoAgo(2),
        status: "active",
      },
      {
        id: "stf_invited",
        email: "dr.verma@citygeneral.health",
        firstName: "Anand",
        lastName: "Verma",
        role: "Clinician",
        department: "Cardiology",
        specialization: "Cardiologist",
        licenseNumber: "MCI-MH-66112",
        licenseStatus: "pending_verification",
        invitationStatus: "pending",
        invitedAt: isoAgo(1),
        status: "active",
      },
    ],
    patients: [
      {
        id: "pt_aarav",
        mrn: "CG-2026-0481",
        firstName: "Aarav",
        lastName: "Mehta",
        email: "aarav.mehta@example.com",
        phone: "+91 98765 43210",
        age: 34,
        sex: "M",
        invitationStatus: "accepted",
        status: "active",
        registeredAt: isoAgo(40),
      },
      {
        id: "pt_neha",
        mrn: "CG-2026-0492",
        firstName: "Neha",
        lastName: "Bansal",
        email: "neha.bansal@example.com",
        phone: "+91 98201 12345",
        age: 41,
        sex: "F",
        invitationStatus: "accepted",
        status: "active",
        registeredAt: isoAgo(30),
      },
      {
        id: "pt_vikram",
        mrn: "CG-2026-0501",
        firstName: "Vikram",
        lastName: "Rao",
        email: "vikram.rao@example.com",
        phone: "+91 98201 11122",
        age: 52,
        sex: "M",
        invitationStatus: "accepted",
        status: "active",
        registeredAt: isoAgo(25),
      },
    ],
    assignments: [
      {
        id: "asg_seed_1",
        patientId: "pt_aarav",
        clinicianId: "stf_priya",
        status: "active",
        createdAt: isoAgo(30),
        consentedAt: isoAgo(28),
      },
      {
        id: "asg_seed_2",
        patientId: "pt_neha",
        clinicianId: "stf_priya",
        status: "active",
        createdAt: isoAgo(20),
        consentedAt: isoAgo(20),
      },
      {
        id: "asg_seed_3",
        patientId: "pt_vikram",
        clinicianId: "stf_rohan",
        status: "active",
        createdAt: isoAgo(15),
        consentedAt: isoAgo(15),
      },
    ],
    templates: [
      {
        id: "tpl_apt_t24h",
        name: "Appointment reminder · T-24h",
        type: "appointment_reminder_t24h",
        subject: "Reminder: Tomorrow's appointment at {{org_name}}",
        body: "Dear {{patient_name}},\n\nReminder: appointment tomorrow with {{clinician_name}} at {{appointment_time}}.\n\nLocation: {{org_name}}\n{{org_address}}\n\nReschedule: {{reschedule_link}}\n\n— {{org_name}} Team",
        channels: ["email", "sms"],
        active: true,
        version: "v1.0",
        updatedAt: isoAgo(15),
      },
      {
        id: "tpl_apt_t1h",
        name: "Appointment reminder · T-1h",
        type: "appointment_reminder_t1h",
        subject: "Your appointment is in 1 hour",
        body: "Hi {{patient_name}}, your appointment with {{clinician_name}} starts in 1 hour. See you soon.",
        channels: ["sms", "in_app"],
        active: true,
        version: "v1.0",
        updatedAt: isoAgo(15),
      },
      {
        id: "tpl_new_record",
        name: "New record available",
        type: "new_record",
        subject: "New record from {{clinician_name}}",
        body: "Hi {{patient_name}}, {{clinician_name}} has finalized a new {{record_type}} on your chart. View it here: {{record_link}}",
        channels: ["email", "in_app"],
        active: true,
        version: "v1.0",
        updatedAt: isoAgo(10),
      },
    ],
    notifications: [
      {
        id: "antf_seed_1",
        type: "invitation",
        title: "1 staff invitation pending",
        body: "Dr. Anand Verma — invited yesterday, not yet accepted.",
        href: "/admin/users",
        read: false,
        createdAt: isoAgo(0, 8),
      },
      {
        id: "antf_seed_2",
        type: "consent",
        title: "License verification needed",
        body: "Dr. Pradeep Joshi's license is pending verification.",
        href: "/admin/clinicians",
        read: false,
        createdAt: isoAgo(2),
      },
    ],
    onboarding: {
      orgProfileComplete: true,
      departmentsCreated: true,
      complianceManagerInvited: true,
      firstStaffInvited: true,
      firstPatientInvited: true,
      templatesConfigured: true,
      schedulePolicySet: true,
    },
    audit: [
      {
        id: "aud_seed_1",
        type: "user.invite",
        actor: "Maya Iyer",
        subject: "dr.verma@citygeneral.health",
        description: "Invited Dr. Anand Verma as Clinician",
        at: isoAgo(1, 14),
      },
      {
        id: "aud_seed_2",
        type: "tenant.activate",
        actor: "Sensussoft Super Admin",
        description: "Tenant City General Hospital activated",
        at: isoAgo(20, 9),
      },
    ],
    consentPolicyVersion: "v2.4",
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const STORAGE_KEY = "hs_admin_store_v1";

function loadFromStorage(): Omit<AdminState, "hydrated"> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Omit<AdminState, "hydrated">;
  } catch {
    return null;
  }
}

function saveToStorage(state: Omit<AdminState, "hydrated">): void {
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
  // org
  updateOrgProfile(patch: Partial<OrgProfile>): void;
  updateRetention(patch: Partial<RetentionPolicy>): void;
  updateChannels(patch: Partial<Channels>): void;
  updateSchedule(patch: Partial<SchedulePolicy>): void;
  // departments
  addDepartment(name: string, parentId: string | null, description?: string): Department;
  removeDepartment(id: string): void;
  // staff
  addStaff(opts: { email: string; firstName: string; lastName: string; role: StaffRole; department?: string; specialization?: string; licenseNumber?: string }): StaffMember;
  setStaffLicenseStatus(id: string, status: LicenseStatus): void;
  setStaffStatus(id: string, status: ActiveStatus): void;
  forcePasswordReset(id: string): void;
  // patients
  addPatient(opts: { firstName: string; lastName: string; email: string; phone: string; age: number; sex: "M" | "F" | "Other" }): AdminPatient;
  setPatientStatus(id: string, status: ActiveStatus): void;
  // assignments
  createAssignment(patientId: string, clinicianId: string, reason?: string): Assignment;
  markAssignmentConsented(id: string): void;
  reassignClinician(patientId: string, fromClinicianId: string, toClinicianId: string): Assignment;
  revokeAssignment(id: string): void;
  // templates
  updateTemplate(id: string, patch: Partial<Template>): void;
  addTemplate(t: Omit<Template, "id" | "updatedAt" | "version">): Template;
  // notifications
  markNotificationRead(id: string): void;
  markAllNotificationsRead(): void;
  addNotification(n: Omit<AdminNotification, "id" | "createdAt" | "read">): void;
  // re-consent campaign
  startReconsentCampaign(newPolicyVersion: string): void;
  // audit
  logAudit(e: Omit<AuditEvent, "id" | "at">): void;
  // onboarding
  markOnboardingStep(step: keyof OnboardingChecklist, done: boolean): void;
  // demo
  resetDemo(): void;
}

const Ctx = React.createContext<({ state: AdminState } & StoreActions) | null>(null);

export function AdminStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AdminState>(() => ({ hydrated: false, ...makeSeed() }));

  React.useEffect(() => {
    const stored = loadFromStorage();
    setState({ hydrated: true, ...(stored ?? makeSeed()) });
  }, []);

  React.useEffect(() => {
    if (!state.hydrated) return;
    const { hydrated: _h, ...persistable } = state;
    void _h;
    saveToStorage(persistable);
  }, [state]);

  const actions = React.useMemo<StoreActions>(() => {
    const mutate = (fn: (prev: AdminState) => AdminState) => setState(fn);
    const log = (type: string, description: string, subject?: string) =>
      mutate((prev) => ({
        ...prev,
        audit: [
          { id: newId("aud"), type, actor: "Maya Iyer", subject, description, at: new Date().toISOString() },
          ...prev.audit,
        ].slice(0, 200),
      }));

    return {
      updateOrgProfile(patch) {
        mutate((prev) => ({ ...prev, orgProfile: { ...prev.orgProfile, ...patch } }));
        log("org.update", "Updated organization profile");
      },
      updateRetention(patch) {
        mutate((prev) => ({ ...prev, retention: { ...prev.retention, ...patch } }));
        log("org.retention_update", "Updated retention policy");
      },
      updateChannels(patch) {
        mutate((prev) => ({ ...prev, channels: { ...prev.channels, ...patch } }));
        log("org.channels_update", "Updated notification channels");
      },
      updateSchedule(patch) {
        mutate((prev) => ({ ...prev, schedule: { ...prev.schedule, ...patch } }));
        log("schedule.config", "Updated schedule policy");
      },

      addDepartment(name, parentId, description) {
        const dept: Department = {
          id: newId("dpt"),
          name,
          parentId,
          description,
          createdAt: new Date().toISOString(),
        };
        mutate((prev) => ({ ...prev, departments: [...prev.departments, dept] }));
        log("department.create", `Created department: ${name}`, dept.id);
        return dept;
      },
      removeDepartment(id) {
        mutate((prev) => ({ ...prev, departments: prev.departments.filter((d) => d.id !== id) }));
        log("department.delete", `Deleted department`, id);
      },

      addStaff(opts) {
        const member: StaffMember = {
          id: newId("stf"),
          email: opts.email,
          firstName: opts.firstName,
          lastName: opts.lastName,
          role: opts.role,
          department: opts.department,
          specialization: opts.specialization,
          licenseNumber: opts.licenseNumber,
          licenseStatus: opts.role === "Clinician" ? "pending_verification" : undefined,
          invitationStatus: "pending",
          invitedAt: new Date().toISOString(),
          status: "active",
        };
        mutate((prev) => ({ ...prev, staff: [member, ...prev.staff] }));
        log("user.invite", `Invited ${opts.firstName} ${opts.lastName} as ${opts.role}`, member.id);
        return member;
      },
      setStaffLicenseStatus(id, status) {
        mutate((prev) => ({
          ...prev,
          staff: prev.staff.map((s) => (s.id === id ? { ...s, licenseStatus: status } : s)),
        }));
        log("license.verify", `License ${status} for staff`, id);
      },
      setStaffStatus(id, status) {
        mutate((prev) => ({
          ...prev,
          staff: prev.staff.map((s) => (s.id === id ? { ...s, status } : s)),
        }));
        log("user.status_change", `Staff status → ${status}`, id);
      },
      forcePasswordReset(id) {
        log("password.reset_force", "Forced password reset + all sessions revoked", id);
      },

      addPatient(opts) {
        const patient: AdminPatient = {
          id: newId("pt"),
          mrn: `CG-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
          firstName: opts.firstName,
          lastName: opts.lastName,
          email: opts.email,
          phone: opts.phone,
          age: opts.age,
          sex: opts.sex,
          invitationStatus: "pending",
          status: "active",
          registeredAt: new Date().toISOString(),
        };
        mutate((prev) => ({ ...prev, patients: [patient, ...prev.patients] }));
        log("patient.create", `Registered ${opts.firstName} ${opts.lastName}`, patient.id);
        return patient;
      },
      setPatientStatus(id, status) {
        mutate((prev) => ({
          ...prev,
          patients: prev.patients.map((p) => (p.id === id ? { ...p, status } : p)),
        }));
        log("patient.status_change", `Patient status → ${status}`, id);
      },

      createAssignment(patientId, clinicianId, reason) {
        const assignment: Assignment = {
          id: newId("asg"),
          patientId,
          clinicianId,
          status: "pending_consent",
          createdAt: new Date().toISOString(),
          reason,
        };
        mutate((prev) => ({ ...prev, assignments: [assignment, ...prev.assignments] }));
        log("assignment.create", `Assigned patient to clinician (pending consent)`, assignment.id);
        return assignment;
      },
      markAssignmentConsented(id) {
        mutate((prev) => ({
          ...prev,
          assignments: prev.assignments.map((a) =>
            a.id === id ? { ...a, status: "active", consentedAt: new Date().toISOString() } : a,
          ),
        }));
        log("assignment.consent", "Patient granted consent for assignment", id);
      },
      reassignClinician(patientId, fromClinicianId, toClinicianId) {
        const newAssignment: Assignment = {
          id: newId("asg"),
          patientId,
          clinicianId: toClinicianId,
          status: "pending_consent",
          createdAt: new Date().toISOString(),
          reason: "Transferred from departing clinician",
        };
        mutate((prev) => ({
          ...prev,
          assignments: [
            newAssignment,
            ...prev.assignments.map((a) =>
              a.patientId === patientId && a.clinicianId === fromClinicianId && a.status === "active"
                ? { ...a, status: "transferred" as const }
                : a,
            ),
          ],
        }));
        log("assignment.reassign", "Reassigned patient to new clinician", newAssignment.id);
        return newAssignment;
      },
      revokeAssignment(id) {
        mutate((prev) => ({
          ...prev,
          assignments: prev.assignments.map((a) => (a.id === id ? { ...a, status: "revoked" } : a)),
        }));
        log("assignment.revoke", "Assignment revoked", id);
      },

      updateTemplate(id, patch) {
        mutate((prev) => ({
          ...prev,
          templates: prev.templates.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...patch,
                  version: incrementVersion(t.version),
                  updatedAt: new Date().toISOString(),
                }
              : t,
          ),
        }));
        log("template.update", `Updated template`, id);
      },
      addTemplate(t) {
        const tpl: Template = {
          ...t,
          id: newId("tpl"),
          version: "v1.0",
          updatedAt: new Date().toISOString(),
        };
        mutate((prev) => ({ ...prev, templates: [tpl, ...prev.templates] }));
        log("template.create", `Created template: ${t.name}`, tpl.id);
        return tpl;
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
        const note: AdminNotification = {
          ...n,
          id: newId("antf"),
          read: false,
          createdAt: new Date().toISOString(),
        };
        mutate((prev) => ({ ...prev, notifications: [note, ...prev.notifications] }));
      },

      startReconsentCampaign(newPolicyVersion) {
        mutate((prev) => ({
          ...prev,
          consentPolicyVersion: newPolicyVersion,
          assignments: prev.assignments.map((a) =>
            a.status === "active" ? { ...a, status: "pending_consent" as const, consentedAt: undefined } : a,
          ),
        }));
        log("consent.campaign", `Re-consent campaign for policy ${newPolicyVersion}`);
      },

      logAudit(e) {
        log(e.type, e.description, e.subject);
      },

      markOnboardingStep(step, done) {
        mutate((prev) => ({ ...prev, onboarding: { ...prev.onboarding, [step]: done } }));
      },

      resetDemo() {
        setState({ hydrated: true, ...makeSeed() });
      },
    };
  }, []);

  const value = React.useMemo(() => ({ state, ...actions }), [state, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function incrementVersion(v: string): string {
  const match = v.match(/^v(\d+)\.(\d+)$/);
  if (!match) return "v1.1";
  const major = match[1];
  const minor = parseInt(match[2], 10) + 1;
  return `v${major}.${minor}`;
}

export function useAdminStore() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useAdminStore must be used within AdminStoreProvider");
  return v;
}

// ---------------------------------------------------------------------------
// Helpers for callers
// ---------------------------------------------------------------------------

export function fullName(s: { firstName: string; lastName: string }): string {
  return `${s.firstName} ${s.lastName}`.trim();
}

export function onboardingProgress(c: OnboardingChecklist): { done: number; total: number; complete: boolean } {
  const keys = Object.keys(c) as (keyof OnboardingChecklist)[];
  const done = keys.filter((k) => c[k]).length;
  return { done, total: keys.length, complete: done === keys.length };
}
