import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type Weekday = (typeof WEEKDAYS)[number];

interface TimeRange {
  start: string;        // "HH:MM"
  end: string;          // "HH:MM"
}

interface DayTemplate {
  /** First availability window of the day (e.g. 09:00–13:00). */
  start: string;
  end: string;
  /** Optional second window for split shifts (e.g. 14:00–17:00 after lunch).
   *  When present, slots are generated for BOTH windows. */
  afternoon?: TimeRange;
  slotMinutes: number;  // 5..240
  off: boolean;
}

type ScheduleTemplate = Partial<Record<Weekday, DayTemplate>>;

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function readTemplate(raw: Prisma.JsonValue | null): ScheduleTemplate {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as ScheduleTemplate;
}

function emptyDay(): DayTemplate {
  return { start: "09:00", end: "17:00", slotMinutes: 15, off: true };
}

async function guard(): Promise<
  | { error: NextResponse; uid?: never }
  | { error?: never; uid: string }
> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Clinician")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 }) };
  return { uid: claims.uid };
}

async function readScheduleTemplate(uid: string): Promise<ScheduleTemplate> {
  // Use $queryRaw so this works even if the generated Prisma client cache is
  // stale and doesn't yet know about the `scheduleTemplate` column. NOTE: the
  // Postgres column name follows the Prisma field name verbatim (camelCase) —
  // it is NOT snake-cased. Using `schedule_template` here returned no rows
  // silently, which made every clinician look like they hadn't published.
  const rows = await prisma.$queryRaw<{ scheduleTemplate: Prisma.JsonValue | null }[]>`
    SELECT "scheduleTemplate" FROM "users" WHERE "id" = ${uid}::uuid LIMIT 1
  `;
  if (rows.length === 0) return {};
  return readTemplate(rows[0].scheduleTemplate);
}

async function writeScheduleTemplate(uid: string, next: ScheduleTemplate): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "users"
       SET "scheduleTemplate" = ${JSON.stringify(next)}::jsonb,
           "updatedAt" = NOW()
     WHERE "id" = ${uid}::uuid
  `;
}

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  const tpl = await readScheduleTemplate(g.uid);
  // Always return all 7 days so the UI can render each row uniformly.
  const full: Record<Weekday, DayTemplate> = {} as Record<Weekday, DayTemplate>;
  for (const d of WEEKDAYS) full[d] = tpl[d] ?? emptyDay();
  return NextResponse.json({ ok: true, template: full });
}

interface PostBody {
  days?: string[];
  start?: string;
  end?: string;
  slotMinutes?: number;
}

/**
 * Saves a recurring availability block for the selected weekdays — same shape
 * as the existing "Add availability" dialog. Each matched day is set to:
 *   { start, end, slotMinutes, off: false }
 * Days NOT in `days` are left untouched (additive — does not clear other days).
 */
export async function POST(req: Request) {
  const g = await guard();
  if (g.error) return g.error;

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const days = Array.isArray(body.days) ? body.days.filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d)) : [];
  if (days.length === 0) {
    return NextResponse.json({ ok: false, error: "Pick at least one day." }, { status: 400 });
  }
  const start = typeof body.start === "string" ? body.start.trim() : "";
  const end = typeof body.end === "string" ? body.end.trim() : "";
  if (!HHMM_RE.test(start) || !HHMM_RE.test(end)) {
    return NextResponse.json({ ok: false, error: "Times must be HH:MM (24h)." }, { status: 400 });
  }
  if (start >= end) {
    return NextResponse.json({ ok: false, error: "End time must be after start time." }, { status: 400 });
  }
  const slotMinutes = typeof body.slotMinutes === "number" ? body.slotMinutes : NaN;
  if (!Number.isFinite(slotMinutes) || slotMinutes < 5 || slotMinutes > 240) {
    return NextResponse.json({ ok: false, error: "Slot length must be 5–240 minutes." }, { status: 400 });
  }

  const existing = await readScheduleTemplate(g.uid);
  const next: ScheduleTemplate = { ...existing };
  for (const d of days) {
    next[d] = { start, end, slotMinutes, off: false };
  }
  await writeScheduleTemplate(g.uid, next);
  const full: Record<Weekday, DayTemplate> = {} as Record<Weekday, DayTemplate>;
  for (const d of WEEKDAYS) full[d] = next[d] ?? emptyDay();
  return NextResponse.json({ ok: true, template: full, savedDays: days });
}

interface PatchBody {
  day?: string;
  template?: DayTemplate;
}

/**
 * Update a single day's template (used by the "edit day" dialog).
 * Accepts an optional `afternoon: { start, end }` for split-shift schedules.
 */
export async function PATCH(req: Request) {
  const g = await guard();
  if (g.error) return g.error;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const day = typeof body.day === "string" ? body.day : "";
  if (!(WEEKDAYS as readonly string[]).includes(day)) {
    return NextResponse.json({ ok: false, error: "Invalid day." }, { status: 400 });
  }
  const t = body.template;
  if (!t || !HHMM_RE.test(t.start) || !HHMM_RE.test(t.end) || t.start >= t.end || t.slotMinutes < 5 || t.slotMinutes > 240) {
    return NextResponse.json({ ok: false, error: "Invalid template." }, { status: 400 });
  }
  // Optional afternoon range — only persisted if both bounds are valid and
  // strictly after the morning window.
  let nextDay: DayTemplate = {
    start: t.start,
    end: t.end,
    slotMinutes: t.slotMinutes,
    off: t.off,
  };
  if (t.afternoon && HHMM_RE.test(t.afternoon.start) && HHMM_RE.test(t.afternoon.end)) {
    if (t.afternoon.start < t.afternoon.end && t.afternoon.start >= t.end) {
      nextDay = { ...nextDay, afternoon: { start: t.afternoon.start, end: t.afternoon.end } };
    }
  }

  const existing = await readScheduleTemplate(g.uid);
  const next: ScheduleTemplate = { ...existing, [day as Weekday]: nextDay };
  await writeScheduleTemplate(g.uid, next);
  const full: Record<Weekday, DayTemplate> = {} as Record<Weekday, DayTemplate>;
  for (const d of WEEKDAYS) full[d] = next[d] ?? emptyDay();
  return NextResponse.json({ ok: true, template: full });
}
