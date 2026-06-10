import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  mailerConfigured,
  sendMail,
  sendSms,
  transportsFromIntegrations,
  type Transport,
} from "@/lib/mail";
import { renderTemplate } from "@/lib/notification-template";

/**
 * Action-email dispatcher. Lifecycle events (appointment confirmed, consent
 * requested/revoked, new document, payment received, …) call into here so a
 * single helper handles three concerns consistently:
 *
 *   1. Render the tenant's *editable* notification template (by slug) when it
 *      exists — admins manage copy at /admin/templates.
 *   2. Fall back to built-in branded copy when the org has no active template.
 *   3. Deliver via the tenant's preferred transport (Resend / SendGrid / SMTP /
 *      Twilio), resolved from `organizations.settings.integrations`.
 *
 * Every function here is best-effort: it never throws and never blocks the
 * user-facing write that triggered it. The in-app notification feed is derived
 * from domain tables (see /api/notifications), so it updates automatically once
 * the underlying row changes — these helpers add the *email* leg.
 */

/** Absolute base URL for building portal links inside emails. */
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

interface IntegrationFlags {
  sendgrid?: boolean;
  twilioSms?: boolean;
  customSmtp?: boolean;
}

/** Resolve a tenant's preferred mail transports from settings.integrations. */
export async function orgTransports(orgId: string): Promise<Transport[]> {
  try {
    const rows = await prisma.$queryRaw<{ settings: Prisma.JsonValue }[]>`
      SELECT settings FROM organizations WHERE id = ${orgId}::uuid LIMIT 1
    `;
    const settings = rows[0]?.settings;
    const integrations =
      settings && typeof settings === "object" && !Array.isArray(settings)
        ? ((settings as Record<string, unknown>).integrations as IntegrationFlags | undefined)
        : undefined;
    if (!integrations) return [];
    return transportsFromIntegrations({
      sendgrid: !!integrations.sendgrid,
      twilioSms: !!integrations.twilioSms,
      customSmtp: !!integrations.customSmtp,
    });
  } catch {
    return [];
  }
}

export interface NotifyArgs {
  /** Org UUID — used to resolve transports + the editable template. */
  orgId: string;
  to: string | null | undefined;
  toPhone?: string | null;
  /** notification_templates slug to prefer. */
  slug: string;
  vars?: Record<string, string>;
  /** Built-in copy used when the org has no active template for `slug`. */
  fallbackSubject: string;
  fallbackText: string;
  /** Branded HTML — only attached when the built-in copy is used (admin
   *  templates are authored as plain text). */
  fallbackHtml?: string;
  /**
   * When set, the email is sent ONLY if the recipient (resolved by `to`) has
   * the EMAIL channel enabled for this preference category (defaults on for
   * unknown users / categories). Use the recipient role's category key, e.g.
   * "appointments" / "records" / "consents". Omit for transactional / always-on
   * mail (invites, OTP, password reset, security) which must never be gated.
   */
  categoryKey?: string;
}

export interface NotifyResult {
  ok: boolean;
  via?: string;
  error?: string;
  skipped?: boolean;
  usedTemplate?: boolean;
}

/**
 * Send one action email. Renders the tenant template for `slug` when present,
 * else uses the built-in fallback copy. Never throws.
 */
export async function sendActionEmail(args: NotifyArgs): Promise<NotifyResult> {
  const to = (args.to ?? "").trim();
  if (!to) return { ok: false, skipped: true, error: "no recipient" };
  if (!mailerConfigured()) return { ok: false, skipped: true, error: "mailer not configured" };

  // Channel enforcement: honour the recipient's EMAIL toggle for this category.
  if (args.categoryKey) {
    const allowed = await emailAllowedForEmail(to, args.categoryKey);
    if (!allowed) {
      console.log(`[notify] ${args.slug} → ${to} skipped (EMAIL off for "${args.categoryKey}")`);
      return { ok: false, skipped: true, error: "recipient disabled email for this category" };
    }
  }

  let subject = args.fallbackSubject;
  let text = args.fallbackText;
  let usedTemplate = false;
  try {
    const tpl = await renderTemplate(args.orgId, args.slug, args.vars ?? {});
    if (tpl.found && tpl.body.trim()) {
      usedTemplate = true;
      subject = (tpl.subject || "").trim() || args.fallbackSubject;
      text = tpl.body;
    }
  } catch {
    // fall through to the built-in copy
  }

  const prefer = await orgTransports(args.orgId);
  try {
    const res = await sendMail({
      to,
      toPhone: args.toPhone ?? undefined,
      subject,
      text,
      html: usedTemplate ? undefined : args.fallbackHtml,
      prefer,
    });
    if (res.ok) {
      console.log(`[notify] ${args.slug} → ${to} via ${res.via}`);
    } else {
      console.warn(`[notify] ${args.slug} → ${to} failed (via ${res.via}): ${res.error}`);
    }
    return { ok: res.ok, via: res.via, error: res.error, usedTemplate };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[notify] ${args.slug} → ${to} threw:`, error);
    return { ok: false, error, usedTemplate };
  }
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function firstName(full: string | null | undefined): string {
  return (full ?? "").trim().split(/\s+/)[0] || "there";
}

/**
 * Patient-facing appointment lifecycle email. Called by `transitionStatus`
 * (clinician + patient flows) and by the Org-Admin appointment route after a
 * status change. Best-effort; resolves all context from the appointment row.
 */
export async function sendAppointmentEmail(
  appointmentId: string,
  status: "confirmed" | "rejected" | "reschedule_requested",
): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{
      organizationId: string;
      patientName: string | null;
      patientEmail: string | null;
      patientPhone: string | null;
      startsAt: Date;
      proposedStartsAt: Date | null;
      room: string | null;
      clinicianFirst: string | null;
      clinicianLast: string | null;
      orgName: string | null;
    }[]>`
      SELECT a."organizationId"::text AS "organizationId",
             a."patientName", a."patientEmail", a."startsAt", a."proposedStartsAt", a.room,
             pu.phone AS "patientPhone",
             c."firstName" AS "clinicianFirst", c."lastName" AS "clinicianLast",
             o.name AS "orgName"
      FROM appointments a
      LEFT JOIN users c          ON c.id = a."clinicianId"
      LEFT JOIN users pu         ON LOWER(pu.email) = LOWER(a."patientEmail")
      LEFT JOIN organizations o  ON o.id = a."organizationId"
      WHERE a.id = ${appointmentId}::uuid
      LIMIT 1
    `;
    const a = rows[0];
    if (!a || !a.patientEmail) return;

    const first = firstName(a.patientName);
    const clinician = `Dr. ${[a.clinicianFirst, a.clinicianLast].filter(Boolean).join(" ")}`.trim();
    const orgName = a.orgName ?? "HealthSecure";
    const portal = `${appBaseUrl()}/patient/appointments`;

    if (status === "confirmed") {
      await sendActionEmail({
        orgId: a.organizationId,
        to: a.patientEmail,
        categoryKey: "appointments",
        slug: "appointment-confirmed",
        vars: {
          "patient.first_name": first,
          "appointment.title": "appointment",
          "appointment.date": fmtDate(a.startsAt),
          "appointment.time": fmtTime(a.startsAt),
          "appointment.clinician": clinician,
          "appointment.location": a.room ?? "Your clinic",
          "organization.name": orgName,
          action_url: portal,
        },
        fallbackSubject: `Confirmed: your appointment on ${fmtDate(a.startsAt)}`,
        fallbackText:
          `Hi ${first},\n\nYour appointment with ${clinician} is confirmed for ` +
          `${fmtDate(a.startsAt)} at ${fmtTime(a.startsAt)}${a.room ? ` (${a.room})` : ""}.\n\n` +
          `We'll send reminders at T-24h and T-1h.\n\nManage it in your portal: ${portal}\n\n— ${orgName}`,
      });
    } else if (status === "reschedule_requested") {
      const newAt = a.proposedStartsAt ?? a.startsAt;
      await sendActionEmail({
        orgId: a.organizationId,
        to: a.patientEmail,
        categoryKey: "appointments",
        slug: "reschedule-request",
        vars: {
          "patient.first_name": first,
          "appointment.title": "appointment",
          "appointment.old_date": fmtDate(a.startsAt),
          "appointment.old_time": fmtTime(a.startsAt),
          "appointment.date": fmtDate(newAt),
          "appointment.time": fmtTime(newAt),
          "organization.name": orgName,
          action_url: portal,
        },
        fallbackSubject: `Your appointment has a new proposed time`,
        fallbackText:
          `Hi ${first},\n\n${clinician} proposed a new time for your appointment:\n\n` +
          `  Old: ${fmtDate(a.startsAt)} at ${fmtTime(a.startsAt)}\n` +
          `  New: ${fmtDate(newAt)} at ${fmtTime(newAt)}\n\n` +
          `Open your portal to accept it or pick another slot: ${portal}\n\n— ${orgName}`,
      });
    } else if (status === "rejected") {
      await sendActionEmail({
        orgId: a.organizationId,
        to: a.patientEmail,
        categoryKey: "appointments",
        slug: "appointment-rejected",
        vars: {
          "patient.first_name": first,
          "appointment.date": fmtDate(a.startsAt),
          "appointment.time": fmtTime(a.startsAt),
          "appointment.clinician": clinician,
          "organization.name": orgName,
          action_url: portal,
        },
        fallbackSubject: `Update on your appointment request`,
        fallbackText:
          `Hi ${first},\n\nUnfortunately your requested appointment with ${clinician} on ` +
          `${fmtDate(a.startsAt)} at ${fmtTime(a.startsAt)} could not be confirmed.\n\n` +
          `Please open your portal to request another time: ${portal}\n\n— ${orgName}`,
      });
    }

    // SMS leg — only when the patient turned SMS on for appointments + has a phone.
    const newAtSms = a.proposedStartsAt ?? a.startsAt;
    const smsText =
      status === "confirmed"
        ? `${orgName}: appointment confirmed for ${fmtDate(a.startsAt)} at ${fmtTime(a.startsAt)}.`
        : status === "reschedule_requested"
          ? `${orgName}: ${clinician} proposed a new time — ${fmtDate(newAtSms)} at ${fmtTime(newAtSms)}. Open your portal to confirm.`
          : `${orgName}: your requested appointment on ${fmtDate(a.startsAt)} could not be confirmed. Please pick another time in your portal.`;
    await sendActionSms({
      toPhone: a.patientPhone,
      recipientEmail: a.patientEmail,
      categoryKey: "appointments",
      text: smsText,
    });
  } catch (err) {
    console.error("[notify] sendAppointmentEmail failed", err);
  }
}

// ---------------------------------------------------------------------------
// Notification-preference helpers — read `notification_preferences.prefs`
// (category × channel matrix) so event dispatch honours what the recipient
// chose in Settings → Alerts. Defaults mirror `NotificationPreferences`'
// `defaultsFor`, so a user with no saved row still gets sensible channels.
// ---------------------------------------------------------------------------

const CRITICAL_CATEGORY_KEYS = new Set(["security", "incidents"]);

/** Default on/off for a category × channel when the user has no saved pref. */
export function channelDefault(key: string, channel: "inApp" | "email" | "sms"): boolean {
  const critical = CRITICAL_CATEGORY_KEYS.has(key);
  if (channel === "inApp") return true;
  if (channel === "email") return critical ? true : key !== "marketing";
  return critical; // sms — off by default except for critical categories
}

/** Whether a stored prefs blob has `channel` enabled for `key` (critical clamp). */
export function prefChannelOn(
  prefs: unknown,
  key: string,
  channel: "inApp" | "email" | "sms",
): boolean {
  // Critical categories keep in-app + email on no matter what.
  if (CRITICAL_CATEGORY_KEYS.has(key) && (channel === "inApp" || channel === "email")) return true;
  const map =
    prefs && typeof prefs === "object" && !Array.isArray(prefs)
      ? (prefs as Record<string, unknown>)
      : null;
  const cat = map?.[key];
  const state =
    cat && typeof cat === "object" && !Array.isArray(cat) ? (cat as Record<string, unknown>) : null;
  const v = state?.[channel];
  return typeof v === "boolean" ? v : channelDefault(key, channel);
}

/**
 * Channel enforcement for outbound email: resolve the recipient by email and
 * return whether they have EMAIL enabled for `categoryKey`. Returns `true`
 * (don't block) when the address isn't a known user (external/invite) or on
 * any error — so transactional mail to non-users is never accidentally dropped.
 */
export async function emailAllowedForEmail(email: string, categoryKey: string): Promise<boolean> {
  const addr = email.trim().toLowerCase();
  if (!addr) return true;
  try {
    const rows = await prisma.$queryRaw<{ prefs: unknown }[]>`
      SELECT np.prefs
      FROM users u
      LEFT JOIN notification_preferences np ON np."userId" = u.id
      WHERE LOWER(u.email) = ${addr} AND u."deletedAt" IS NULL
      LIMIT 1
    `;
    if (rows.length === 0) return true; // not a portal user → don't gate
    return prefChannelOn(rows[0].prefs ?? null, categoryKey, "email");
  } catch {
    return true; // best-effort: never block delivery on a lookup error
  }
}

/**
 * SMS channel gate: resolve the recipient by email and return whether they
 * have SMS enabled for `categoryKey`. Unlike email, SMS is OPT-IN — unknown
 * addresses / errors return false so we never text a non-user, and the
 * per-category default is off (except critical, see `channelDefault`).
 */
export async function smsAllowedForEmail(email: string | null | undefined, categoryKey: string): Promise<boolean> {
  const addr = (email ?? "").trim().toLowerCase();
  if (!addr) return false;
  try {
    const rows = await prisma.$queryRaw<{ prefs: unknown }[]>`
      SELECT np.prefs
      FROM users u
      LEFT JOIN notification_preferences np ON np."userId" = u.id
      WHERE LOWER(u.email) = ${addr} AND u."deletedAt" IS NULL
      LIMIT 1
    `;
    if (rows.length === 0) return false;
    return prefChannelOn(rows[0].prefs ?? null, categoryKey, "sms");
  } catch {
    return false;
  }
}

export interface SmsArgs {
  toPhone: string | null | undefined;
  text: string;
  /** Recipient email used to resolve their SMS preference. */
  recipientEmail?: string | null;
  /** Preference category to gate on (omit to always send when a phone exists). */
  categoryKey?: string;
}

/**
 * Send a notification SMS via Twilio, honouring the recipient's SMS toggle for
 * `categoryKey`. Best-effort; never throws. No-op (skipped) when there's no
 * phone, Twilio isn't configured, or the recipient disabled SMS for the category.
 */
export async function sendActionSms(args: SmsArgs): Promise<NotifyResult> {
  const phone = (args.toPhone ?? "").trim();
  if (!phone) return { ok: false, skipped: true, error: "no phone" };
  if (args.categoryKey) {
    const allowed = await smsAllowedForEmail(args.recipientEmail, args.categoryKey);
    if (!allowed) {
      console.log(`[notify] sms → ${phone} skipped (SMS off for "${args.categoryKey}")`);
      return { ok: false, skipped: true, error: "recipient disabled sms for this category" };
    }
  }
  try {
    const res = await sendSms({ toPhone: phone, text: args.text });
    if (res.ok) console.log(`[notify] sms → ${phone} via ${res.via}`);
    else console.warn(`[notify] sms → ${phone} failed: ${res.error}`);
    return { ok: res.ok, via: res.via, error: res.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Scope-key → human label (mirrors the consent UI). */
const SCOPE_LABEL: Record<string, string> = {
  lab: "Lab Reports",
  prescriptions: "Prescriptions",
  notes: "Clinical Notes",
  imaging: "Imaging",
  mental_health: "Mental Health",
  insurance: "Insurance",
  id_proof: "ID Proof",
  other: "Other records",
};
export function scopeLabels(scopes: string[]): string {
  const labels = scopes.map((s) => SCOPE_LABEL[s] ?? s);
  if (labels.length === 0) return "selected records";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}
