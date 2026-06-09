import { prisma } from "@/lib/prisma";
import { sendAppointmentEmail } from "@/lib/notify";

/**
 * Single source of truth for the appointment lifecycle. Every status change
 * — whether the patient books, the clinician confirms / reschedules / marks
 * arrived / completes, or anyone cancels — goes through `transitionStatus`
 * so the audit ledger picks it up automatically.
 *
 * Status flow:
 *
 *   requested              ← patient books
 *      │
 *      ├─→ confirmed            ← clinician confirms
 *      │      │
 *      │      ├─→ arrived       ← clinician marks patient arrived
 *      │      │     │
 *      │      │     └─→ in_progress  ← clinician starts consultation
 *      │      │             │
 *      │      │             └─→ completed
 *      │      └─→ no_show / cancelled
 *      │
 *      ├─→ reschedule_requested  ← clinician proposes a new slot
 *      │      │
 *      │      └─→ confirmed     ← patient accepts the proposed slot
 *      │
 *      └─→ cancelled            ← patient cancels before confirmation
 */

export type AppointmentLifecycleStatus =
  | "requested"
  | "reschedule_requested"
  | "confirmed"
  | "arrived"
  | "in_progress"
  | "no_show"
  | "blocked"
  | "cancelled"
  | "rejected"
  | "completed";

const ALL_STATUSES = new Set<AppointmentLifecycleStatus>([
  "requested",
  "reschedule_requested",
  "confirmed",
  "arrived",
  "in_progress",
  "no_show",
  "blocked",
  "cancelled",
  "rejected",
  "completed",
]);

const TRANSITIONS: Record<AppointmentLifecycleStatus, AppointmentLifecycleStatus[]> = {
  requested:            ["confirmed", "reschedule_requested", "cancelled", "rejected"],
  reschedule_requested: ["confirmed", "cancelled", "requested", "rejected"],
  confirmed:            ["arrived", "in_progress", "no_show", "cancelled", "reschedule_requested"],
  arrived:              ["in_progress", "completed", "no_show", "cancelled"],
  in_progress:          ["completed", "cancelled"],
  no_show:              [],
  blocked:              ["cancelled"],
  cancelled:            [],
  rejected:             [],
  completed:            [],
};

export function canTransition(from: string, to: string): boolean {
  if (!ALL_STATUSES.has(to as AppointmentLifecycleStatus)) return false;
  if (!(from in TRANSITIONS)) return false;
  return TRANSITIONS[from as AppointmentLifecycleStatus].includes(to as AppointmentLifecycleStatus);
}

export interface AuditActor {
  uid: string | null;
  email: string | null;
  role: string | null;
}

export interface TransitionInput {
  appointmentId: string;
  organizationId: string;
  newStatus: AppointmentLifecycleStatus;
  actor: AuditActor;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  /** Skip the from→to transition validity check (use for the initial INSERT path). */
  initial?: boolean;
}

/**
 * Update the appointment's status + write an audit row in one transaction.
 * Returns the updated row's new status (or null if the appointment doesn't
 * exist / the transition was rejected). The caller is responsible for any
 * side effects (e.g. scheduling reminders).
 */
export async function transitionStatus(input: TransitionInput): Promise<{
  ok: true; previous: string; next: AppointmentLifecycleStatus;
} | { ok: false; error: string }> {
  // Load current status via raw SQL — the generated Prisma client doesn't
  // know the new enum values yet (Windows DLL lock prevents `prisma generate`).
  const rows = await prisma.$queryRaw<{ status: string; organizationId: string }[]>`
    SELECT status::text AS status, "organizationId"::text AS "organizationId"
    FROM appointments WHERE id = ${input.appointmentId}::uuid LIMIT 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Appointment not found." };
  if (row.organizationId !== input.organizationId)
    return { ok: false, error: "Appointment is in a different tenant." };

  if (!input.initial && !canTransition(row.status, input.newStatus))
    return { ok: false, error: `Cannot move appointment from ${row.status} to ${input.newStatus}.` };

  await prisma.$executeRaw`
    UPDATE appointments
    SET status = ${input.newStatus}::"AppointmentStatus",
        "updatedAt" = NOW()
    WHERE id = ${input.appointmentId}::uuid
  `;

  await writeAudit({
    appointmentId: input.appointmentId,
    organizationId: input.organizationId,
    previousStatus: row.status,
    newStatus: input.newStatus,
    actor: input.actor,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });

  // Patient-facing email leg (best-effort — never blocks the transition).
  if (
    input.newStatus === "confirmed" ||
    input.newStatus === "rejected" ||
    input.newStatus === "reschedule_requested"
  ) {
    await sendAppointmentEmail(input.appointmentId, input.newStatus);
  }

  return { ok: true, previous: row.status, next: input.newStatus };
}

/** Write an audit row WITHOUT updating the appointment — useful for the
 *  initial INSERT path where we want one audit entry recording the
 *  patient-initiated `requested` state. */
export async function writeAudit(params: {
  appointmentId: string;
  organizationId: string;
  previousStatus: string | null;
  newStatus: string;
  actor: AuditActor;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO appointment_audit_log
        ("appointmentId", "organizationId", "previousStatus", "newStatus",
         "changedById", "changedByEmail", "changedByRole",
         reason, metadata)
      VALUES
        (${params.appointmentId}::uuid, ${params.organizationId}::uuid,
         ${params.previousStatus}, ${params.newStatus},
         ${params.actor.uid ? params.actor.uid : null}::uuid,
         ${params.actor.email}, ${params.actor.role},
         ${params.reason ?? null},
         ${JSON.stringify(params.metadata ?? {})}::jsonb)
    `;
  } catch (err) {
    // Audit failures must never break the user-facing flow.
    console.error("[appointment-lifecycle] writeAudit failed", err);
  }
}

/**
 * Insert two reminder rows for an appointment: T-24h and T-1h. Idempotent —
 * the unique constraint on (appointmentId, kind) lets the clinician click
 * "Confirm" multiple times without piling up duplicates. The actual outbound
 * channel (email/SMS) is out of scope for this slice; the rows exist so the
 * scheduler / dashboards have something real to surface.
 */
export async function scheduleReminders(params: {
  appointmentId: string;
  organizationId: string;
  startsAt: Date;
}): Promise<void> {
  const t24 = new Date(params.startsAt.getTime() - 24 * 60 * 60 * 1000);
  const t1  = new Date(params.startsAt.getTime() - 1 * 60 * 60 * 1000);
  try {
    await prisma.$executeRaw`
      INSERT INTO appointment_reminders ("appointmentId", "organizationId", kind, "scheduledAt")
      VALUES (${params.appointmentId}::uuid, ${params.organizationId}::uuid, 't_24h', ${t24})
      ON CONFLICT ("appointmentId", kind) DO UPDATE SET "scheduledAt" = EXCLUDED."scheduledAt"
    `;
    await prisma.$executeRaw`
      INSERT INTO appointment_reminders ("appointmentId", "organizationId", kind, "scheduledAt")
      VALUES (${params.appointmentId}::uuid, ${params.organizationId}::uuid, 't_1h', ${t1})
      ON CONFLICT ("appointmentId", kind) DO UPDATE SET "scheduledAt" = EXCLUDED."scheduledAt"
    `;
  } catch (err) {
    console.error("[appointment-lifecycle] scheduleReminders failed", err);
  }
}

/**
 * Cancel any not-yet-sent reminders for this appointment (used when the
 * clinician reschedules or someone cancels the appointment).
 */
export async function cancelReminders(appointmentId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      DELETE FROM appointment_reminders
      WHERE "appointmentId" = ${appointmentId}::uuid
        AND "sentAt" IS NULL
    `;
  } catch (err) {
    console.error("[appointment-lifecycle] cancelReminders failed", err);
  }
}

/** Human-friendly label for a status — used by toasts/badges. */
export function statusLabel(s: string): string {
  switch (s) {
    case "requested": return "Requested";
    case "reschedule_requested": return "Reschedule requested";
    case "confirmed": return "Confirmed";
    case "arrived": return "Arrived";
    case "in_progress": return "In progress";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    case "rejected": return "Rejected";
    case "no_show": return "No-show";
    case "blocked": return "Blocked";
    default: return s;
  }
}
