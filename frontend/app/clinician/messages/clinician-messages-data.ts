/**
 * Mock clinician message threads. Each thread has a small message log
 * so the detail page has something to render. Standalone — no shared
 * store dependency (the clinician layout doesn't provide the patient
 * store).
 */

export type Flag = "urgent" | "lab-ready" | "consent-pending";

export interface MsgAttachment {
  name: string;
  size: number;
  kind: "file" | "image";
}

export interface ClinicianMessage {
  id: string;
  from: "clinician" | "patient";
  body: string;
  at: string; // ISO 8601
  attachments?: MsgAttachment[];
}

export interface ClinicianThread {
  id: string;
  patient: string;
  initials: string;
  mrn: string;
  role: string;
  preview: string;
  time: string;
  unread: number;
  flag?: Flag;
  attachment?: boolean;
  sentByMe?: boolean;
  read?: boolean;
  pinned?: boolean;
  lastActivity: string;
  messages: ClinicianMessage[];
}

const now = new Date();
const iso = (minsAgo: number): string =>
  new Date(now.getTime() - minsAgo * 60_000).toISOString();

export const THREADS: ClinicianThread[] = [
  {
    id: "t-1",
    patient: "Aarav Mehta",
    initials: "AM",
    mrn: "MRN-44118",
    role: "Patient · Cardiology panel",
    preview: "Doctor, I've been having mild chest tightness for two days. Should I come in?",
    time: "12m ago",
    unread: 2,
    flag: "urgent",
    lastActivity: iso(12),
    messages: [
      {
        id: "m1",
        from: "patient",
        body: "Doctor, I started feeling mild chest tightness two days ago, mostly after climbing stairs. Should I be worried?",
        at: iso(45),
      },
      {
        id: "m2",
        from: "patient",
        body: "It comes and goes. No pain in the arm, no shortness of breath at rest. Reading my BP today: 138/86.",
        at: iso(40),
      },
      {
        id: "m3",
        from: "patient",
        body: "Doctor, I've been having mild chest tightness for two days. Should I come in?",
        at: iso(12),
      },
    ],
  },
  {
    id: "t-2",
    patient: "Riya Mehta",
    initials: "RM",
    mrn: "MRN-44119",
    role: "Patient · Endocrinology panel",
    preview: "Lab report attached for your review.",
    time: "1h ago",
    unread: 1,
    flag: "lab-ready",
    attachment: true,
    lastActivity: iso(60),
    messages: [
      {
        id: "m1",
        from: "patient",
        body: "Hi Doctor, picking up my Tuesday lab work. Attaching the lipid panel they handed me.",
        at: iso(70),
      },
      {
        id: "m2",
        from: "patient",
        body: "Lab report attached for your review.",
        at: iso(60),
        attachments: [{ name: "lipid_panel_may26.pdf", size: 184_320, kind: "file" }],
      },
    ],
  },
  {
    id: "t-3",
    patient: "Tarun Mehta",
    initials: "TM",
    mrn: "MRN-44120",
    role: "Patient · Cardiology panel",
    preview: "Thanks for the prescription. Picking it up this evening.",
    time: "3h ago",
    unread: 0,
    read: true,
    pinned: true,
    lastActivity: iso(180),
    messages: [
      {
        id: "m1",
        from: "clinician",
        body: "I've sent the refill to your pharmacy. Continue 20mg nightly and let me know if any muscle soreness develops.",
        at: iso(220),
      },
      {
        id: "m2",
        from: "patient",
        body: "Thanks for the prescription. Picking it up this evening.",
        at: iso(180),
      },
    ],
  },
  {
    id: "t-4",
    patient: "Aanya Verma",
    initials: "AV",
    mrn: "MRN-44211",
    role: "Patient · Internal Medicine panel",
    preview: 'Your message: "Switching to the lower dose starting tomorrow. Let me know if dizziness persists."',
    time: "Yesterday",
    unread: 0,
    sentByMe: true,
    read: true,
    lastActivity: iso(60 * 24),
    messages: [
      {
        id: "m1",
        from: "patient",
        body: "Doctor, I've been feeling lightheaded in the mornings, around 1 hour after my dose.",
        at: iso(60 * 26),
      },
      {
        id: "m2",
        from: "clinician",
        body: "Let's reduce to 5mg starting tomorrow morning and see how you feel for a week.",
        at: iso(60 * 25),
      },
      {
        id: "m3",
        from: "clinician",
        body: "Switching to the lower dose starting tomorrow. Let me know if dizziness persists.",
        at: iso(60 * 24),
      },
    ],
  },
  {
    id: "t-5",
    patient: "Kabir Joshi",
    initials: "KJ",
    mrn: "MRN-44309",
    role: "Patient · Radiology referral",
    preview: "Consent for sharing imaging with Dr. Iyer is pending. Please review before our next visit.",
    time: "Yesterday",
    unread: 0,
    flag: "consent-pending",
    lastActivity: iso(60 * 28),
    messages: [
      {
        id: "m1",
        from: "clinician",
        body: "I'd like Dr. Iyer (Internal Medicine) to look at last month's MRI before our consult on Friday.",
        at: iso(60 * 32),
      },
      {
        id: "m2",
        from: "patient",
        body: "Consent for sharing imaging with Dr. Iyer is pending. Please review before our next visit.",
        at: iso(60 * 28),
      },
    ],
  },
  {
    id: "t-6",
    patient: "Meera Singh",
    initials: "MS",
    mrn: "MRN-44402",
    role: "Patient · Cardiology panel",
    preview: "Follow-up scheduled for next Tuesday at 10:30 AM. Confirming attendance.",
    time: "May 24",
    unread: 0,
    read: true,
    lastActivity: iso(60 * 48),
    messages: [
      {
        id: "m1",
        from: "clinician",
        body: "Let's reassess your symptoms next week. Tuesday 10:30 AM works for me — confirm?",
        at: iso(60 * 50),
      },
      {
        id: "m2",
        from: "patient",
        body: "Follow-up scheduled for next Tuesday at 10:30 AM. Confirming attendance.",
        at: iso(60 * 48),
      },
    ],
  },
];

export function getThread(id: string): ClinicianThread | undefined {
  return THREADS.find((t) => t.id === id);
}

export const FLAG_META: Record<Flag, { label: string; variant: "danger" | "info" | "warning" }> = {
  urgent: { label: "Urgent", variant: "danger" },
  "lab-ready": { label: "Lab ready", variant: "info" },
  "consent-pending": { label: "Consent pending", variant: "warning" },
};
