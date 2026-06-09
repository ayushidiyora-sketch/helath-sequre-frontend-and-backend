import type { Prisma } from "@prisma/client";

/**
 * Shared shape + reader for the tenant's `organizations.settings.schedule`
 * JSON sub-key. Used by:
 *   - /api/admin/schedule-config — read + clamp + write
 *   - /api/admin/appointments POST — conflict + working-hours check
 *
 * Keeping the shape in one file means the conflict-detector can never drift
 * out of sync with what the editor saves.
 */

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export interface DayHours {
  enabled: boolean;
  open: string; // "HH:MM"
  close: string; // "HH:MM"
}

export interface ScheduleShape {
  workingHours: Record<DayKey, DayHours>;
  defaultSlotMinutes: number;
  reschedulePolicy: { minHoursBefore: number };
  cancellationPolicy: { minHoursBefore: number };
  reminders: { t24h: boolean; t1h: boolean; noShowFollowup: boolean };
}

export const SCHEDULE_DEFAULTS: ScheduleShape = {
  workingHours: {
    mon: { enabled: true, open: "09:00", close: "17:00" },
    tue: { enabled: true, open: "09:00", close: "17:00" },
    wed: { enabled: true, open: "09:00", close: "17:00" },
    thu: { enabled: true, open: "09:00", close: "17:00" },
    fri: { enabled: true, open: "09:00", close: "17:00" },
    sat: { enabled: false, open: "09:00", close: "13:00" },
    sun: { enabled: false, open: "09:00", close: "13:00" },
  },
  defaultSlotMinutes: 30,
  reschedulePolicy: { minHoursBefore: 24 },
  cancellationPolicy: { minHoursBefore: 12 },
  reminders: { t24h: true, t1h: true, noShowFollowup: false },
};

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

function coerceTime(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  return /^\d{2}:\d{2}$/.test(v) ? v : fallback;
}

function coerceBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function readSchedule(settings: Prisma.JsonValue | null | undefined): ScheduleShape {
  const obj = settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
  const s = obj.schedule && typeof obj.schedule === "object" && !Array.isArray(obj.schedule)
    ? (obj.schedule as Record<string, unknown>)
    : {};

  const wh = s.workingHours && typeof s.workingHours === "object" && !Array.isArray(s.workingHours)
    ? (s.workingHours as Record<string, unknown>)
    : {};
  const workingHours = {} as ScheduleShape["workingHours"];
  for (const day of DAY_KEYS) {
    const raw = wh[day] && typeof wh[day] === "object" && !Array.isArray(wh[day])
      ? (wh[day] as Record<string, unknown>)
      : {};
    workingHours[day] = {
      enabled: coerceBool(raw.enabled, SCHEDULE_DEFAULTS.workingHours[day].enabled),
      open: coerceTime(raw.open, SCHEDULE_DEFAULTS.workingHours[day].open),
      close: coerceTime(raw.close, SCHEDULE_DEFAULTS.workingHours[day].close),
    };
  }

  const rp = s.reschedulePolicy && typeof s.reschedulePolicy === "object" && !Array.isArray(s.reschedulePolicy)
    ? (s.reschedulePolicy as Record<string, unknown>)
    : {};
  const cp = s.cancellationPolicy && typeof s.cancellationPolicy === "object" && !Array.isArray(s.cancellationPolicy)
    ? (s.cancellationPolicy as Record<string, unknown>)
    : {};
  const rm = s.reminders && typeof s.reminders === "object" && !Array.isArray(s.reminders)
    ? (s.reminders as Record<string, unknown>)
    : {};

  return {
    workingHours,
    defaultSlotMinutes: clampInt(s.defaultSlotMinutes, 5, 240, SCHEDULE_DEFAULTS.defaultSlotMinutes),
    reschedulePolicy: { minHoursBefore: clampInt(rp.minHoursBefore, 0, 168, SCHEDULE_DEFAULTS.reschedulePolicy.minHoursBefore) },
    cancellationPolicy: { minHoursBefore: clampInt(cp.minHoursBefore, 0, 168, SCHEDULE_DEFAULTS.cancellationPolicy.minHoursBefore) },
    reminders: {
      t24h: coerceBool(rm.t24h, SCHEDULE_DEFAULTS.reminders.t24h),
      t1h: coerceBool(rm.t1h, SCHEDULE_DEFAULTS.reminders.t1h),
      noShowFollowup: coerceBool(rm.noShowFollowup, SCHEDULE_DEFAULTS.reminders.noShowFollowup),
    },
  };
}

/**
 * Day index (0=Mon … 6=Sun) → working-hours key. JS `getDay()` returns
 * 0=Sun … 6=Sat, so we map it.
 */
export function dayKeyForDate(d: Date): DayKey {
  const jsDay = d.getDay(); // 0=Sun … 6=Sat
  const mapping: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return mapping[jsDay];
}

/**
 * Returns null if `startsAt + duration` lies wholly within the working
 * window for that day; otherwise a human-readable reason for the rejection.
 */
export function checkWorkingHours(
  schedule: ScheduleShape,
  startsAt: Date,
  durationMinutes: number,
): { ok: true } | { ok: false; reason: string; dayKey: DayKey; window: DayHours } {
  const dayKey = dayKeyForDate(startsAt);
  const window = schedule.workingHours[dayKey];
  if (!window.enabled) {
    return { ok: false, reason: `Clinic is closed on ${dayKey.toUpperCase()}.`, dayKey, window };
  }
  const start = startsAt.getHours() * 60 + startsAt.getMinutes();
  const end = start + durationMinutes;
  const [oh, om] = window.open.split(":").map(Number);
  const [ch, cm] = window.close.split(":").map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  if (start < openMin || end > closeMin) {
    return {
      ok: false,
      reason: `Outside working hours (${window.open}–${window.close}).`,
      dayKey,
      window,
    };
  }
  return { ok: true };
}
