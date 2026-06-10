import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Available time slots for the signed-in clinician on a given date, derived
 * from their `scheduleTemplate` for that weekday MINUS already-booked times
 * (and past times when the date is today). Used by the reschedule "Propose a
 * new slot" dialog so the New time field is a dropdown of real, open slots.
 *
 *   GET /api/clinician/slots?date=YYYY-MM-DD → { ok, times: ["9:15 AM", …], slotMinutes, off }
 *
 * Slot generation mirrors /api/patient/clinicians/[id]/slots (same template
 * shape + 12h labels) so the patient + clinician sides agree on the grid.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_LABELS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;
type WeekdayLabel = (typeof WEEKDAY_LABELS)[number];

interface TimeRange { start: string; end: string }
interface DayTemplate { start: string; end: string; afternoon?: TimeRange; slotMinutes: number; off: boolean }
type ScheduleTemplate = Partial<Record<WeekdayLabel, DayTemplate>>;

function readTemplate(raw: Prisma.JsonValue | null): ScheduleTemplate {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as ScheduleTemplate;
}
function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
function slotLabelToMinutes(label: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label.trim());
  if (!m) return -1;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}
function buildWindow(start: string, end: string, slotMinutes: number): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin || slotMinutes <= 0) return [];
  const out: string[] = [];
  for (let cur = startMin; cur + slotMinutes <= endMin; cur += slotMinutes) {
    out.push(fmt12(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`));
  }
  return out;
}
function buildSlotsForDay(t: DayTemplate): string[] {
  if (t.off || t.slotMinutes <= 0) return [];
  const out: string[] = [];
  if (t.start && t.end) out.push(...buildWindow(t.start, t.end, t.slotMinutes));
  if (t.afternoon?.start && t.afternoon?.end) out.push(...buildWindow(t.afternoon.start, t.afternoon.end, t.slotMinutes));
  return out;
}

export async function GET(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Clinician")
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 });
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, times: [], slotMinutes: 0, off: false });

  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!DATE_RE.test(date))
    return NextResponse.json({ ok: false, error: "Invalid date (YYYY-MM-DD)." }, { status: 400 });

  const rows = await prisma.$queryRaw<{ scheduleTemplate: Prisma.JsonValue | null }[]>`
    SELECT "scheduleTemplate" FROM users WHERE id = ${claims.uid}::uuid LIMIT 1
  `;
  const tpl = readTemplate(rows[0]?.scheduleTemplate ?? null);

  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const raw = tpl[WEEKDAY_LABELS[target.getDay()]];
  // Explicit day-off → no slots. No template for the weekday → fall back to
  // standard clinic hours (9 AM–5 PM, 15-min) so the picker is still usable
  // before the clinician has published an availability template.
  if (raw?.off) {
    return NextResponse.json({ ok: true, times: [], slotMinutes: raw.slotMinutes ?? 0, off: true });
  }
  const day: DayTemplate =
    raw && raw.start && raw.end ? raw : { start: "09:00", end: "17:00", slotMinutes: 15, off: false };

  // Booked times on that date — query a ±1-day window then bucket by LOCAL date
  // (startsAt is a UTC-instant; local getters recover the intended wall time).
  const lo = new Date(y, m - 1, d - 1);
  const hi = new Date(y, m - 1, d + 2);
  const booked = await prisma.$queryRaw<{ startsAt: Date }[]>`
    SELECT "startsAt" FROM appointments
    WHERE "clinicianId" = ${claims.uid}::uuid
      AND "deletedAt" IS NULL
      AND status::text NOT IN ('cancelled','no_show')
      AND "startsAt" >= ${lo} AND "startsAt" < ${hi}
  `;
  const taken = new Set<string>();
  for (const b of booked) {
    const t = b.startsAt;
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    if (key === date) {
      taken.add(fmt12(`${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`));
    }
  }

  let times = buildSlotsForDay(day).filter((t) => !taken.has(t));
  const now = new Date();
  const isToday =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate();
  if (isToday) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    times = times.filter((t) => slotLabelToMinutes(t) > nowMin);
  }

  return NextResponse.json({ ok: true, times, slotMinutes: day.slotMinutes, off: false });
}
