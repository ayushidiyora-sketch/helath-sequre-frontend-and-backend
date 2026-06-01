import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WEEKDAY_LABELS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;
type WeekdayLabel = (typeof WEEKDAY_LABELS)[number];

interface TimeRange {
  start: string;
  end: string;
}

interface DayTemplate {
  start: string;        // first window start "HH:MM"
  end: string;          // first window end
  /** Optional second window (split shift) — both ranges contribute slots. */
  afternoon?: TimeRange;
  slotMinutes: number;
  off: boolean;
}

type ScheduleTemplate = Partial<Record<WeekdayLabel, DayTemplate>>;

function readTemplate(raw: Prisma.JsonValue | null): ScheduleTemplate {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as ScheduleTemplate;
}

/** "Mon, Jun 2" — matches the patient booking grid's expected day label. */
function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** "08:00" → "8:00 AM". Pure formatting, no locale. */
function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function buildWindow(start: string, end: string, slotMinutes: number): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin || slotMinutes <= 0) return [];
  const out: string[] = [];
  for (let cur = startMin; cur + slotMinutes <= endMin; cur += slotMinutes) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    out.push(fmt12(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`));
  }
  return out;
}

function buildSlotsForDay(t: DayTemplate): string[] {
  if (t.off || t.slotMinutes <= 0) return [];
  // First window
  const out: string[] = [];
  if (t.start && t.end) out.push(...buildWindow(t.start, t.end, t.slotMinutes));
  // Optional afternoon window — concatenated, already chronological because
  // PATCH validates afternoon.start >= morning.end.
  if (t.afternoon?.start && t.afternoon?.end) {
    out.push(...buildWindow(t.afternoon.start, t.afternoon.end, t.slotMinutes));
  }
  return out;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Patient")
    return NextResponse.json({ ok: false, error: "Forbidden — Patient only." }, { status: 403 });
  if (!UUID_RE.test(id))
    return NextResponse.json({ ok: false, error: "Invalid clinician id." }, { status: 400 });

  // Use $queryRaw to read scheduleTemplate directly — the Prisma client cache
  // may not yet know about this column (matches the pattern used by
  // /api/clinician/availability). The Postgres column name mirrors Prisma's
  // field name verbatim (camelCase) — using snake_case here silently returns
  // no rows. Other camelCase columns used below: "roleKind", "deletedAt".
  const rows = await prisma.$queryRaw<
    { scheduleTemplate: Prisma.JsonValue | null; roleKind: string; deletedAt: Date | null; status: string }[]
  >`
    SELECT
      "scheduleTemplate",
      "roleKind"::text AS "roleKind",
      "deletedAt",
      "status"::text AS status
    FROM "users"
    WHERE "id" = ${id}::uuid
    LIMIT 1
  `;
  if (rows.length === 0 || rows[0].deletedAt || rows[0].roleKind !== "clinician") {
    return NextResponse.json({ ok: false, error: "Clinician not found." }, { status: 404 });
  }

  const tpl = readTemplate(rows[0].scheduleTemplate);

  // Generate the next 4 weekdays (skipping the clinician's `off` days).
  // Look up to 10 calendar days ahead to find 4 working days. Each entry
  // carries its own `slotMinutes` so the UI can render a per-day "15-min slots"
  // / "30-min slots" badge — the cadence is allowed to differ across days
  // (e.g. Wed 30-min, rest 15-min).
  const out: { day: string; times: string[]; slotMinutes: number }[] = [];
  const today = new Date();
  for (let i = 0; i < 10 && out.length < 4; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const dow = d.getDay();
    const label: WeekdayLabel = WEEKDAY_LABELS[dow];
    const day = tpl[label];
    if (!day || day.off) continue;
    const times = buildSlotsForDay(day);
    if (times.length === 0) continue;
    out.push({ day: dayLabel(d), times, slotMinutes: day.slotMinutes });
  }

  return NextResponse.json({
    ok: true,
    slots: out,
    // `hasTemplate` is `true` when the clinician has saved at least one
    // non-off weekday — lets the UI distinguish "no schedule yet" from
    // "schedule exists but every day is off".
    hasTemplate: Object.values(tpl).some((d) => d && !d.off),
  });
}
