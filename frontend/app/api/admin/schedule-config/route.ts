import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DAY_KEYS,
  SCHEDULE_DEFAULTS,
  type ScheduleShape,
  readSchedule,
} from "@/lib/schedule-config";

export const runtime = "nodejs";

/**
 * Org Admin → /admin/appointments → "Schedule settings" dialog.
 *
 * Stores the tenant's appointment configuration on
 * `organizations.settings.schedule` (JSONB). Like the policy endpoint, this
 * extends the free-form `settings` JSON with one new sub-key — no schema
 * migration.
 *
 *   GET   → current values (+ DEFAULTS for any missing field)
 *   PATCH → save (validated, clamped to safe ranges)
 *
 * The shared shape + clamp helpers live in `lib/schedule-config.ts` so the
 * appointment POST can reuse them for conflict + working-hours checks.
 */

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

async function requireOrgAdmin() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  if (claims.role !== "Org Admin")
    return { error: NextResponse.json({ ok: false, error: "Forbidden — Org Admin only." }, { status: 403 }) };
  if (!claims.org)
    return { error: NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 }) };
  return { claims };
}

export async function GET() {
  const g = await requireOrgAdmin();
  if ("error" in g) return g.error;
  try {
    const [org] = await prisma.$queryRaw<{ id: string; settings: Prisma.JsonValue }[]>`
      SELECT id, settings FROM organizations WHERE slug = ${g.claims.org} LIMIT 1
    `;
    if (!org) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      schedule: readSchedule(org.settings),
      defaults: SCHEDULE_DEFAULTS,
    });
  } catch (err) {
    console.error("[admin schedule-config GET] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const g = await requireOrgAdmin();
  if ("error" in g) return g.error;

  let body: Partial<ScheduleShape>;
  try {
    body = (await req.json()) as Partial<ScheduleShape>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  try {
    const [org] = await prisma.$queryRaw<{ id: string; settings: Prisma.JsonValue }[]>`
      SELECT id, settings FROM organizations WHERE slug = ${g.claims.org} LIMIT 1
    `;
    if (!org) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });

    // Merge with current values so a partial PATCH doesn't blow away other keys.
    const current = readSchedule(org.settings);

    const mergedWorkingHours = { ...current.workingHours };
    if (body.workingHours && typeof body.workingHours === "object") {
      for (const day of DAY_KEYS) {
        const incoming = (body.workingHours as Record<string, unknown>)[day];
        if (incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
          const r = incoming as Record<string, unknown>;
          mergedWorkingHours[day] = {
            enabled: coerceBool(r.enabled, current.workingHours[day].enabled),
            open: coerceTime(r.open, current.workingHours[day].open),
            close: coerceTime(r.close, current.workingHours[day].close),
          };
        }
      }
    }

    const merged: ScheduleShape = {
      workingHours: mergedWorkingHours,
      defaultSlotMinutes: body.defaultSlotMinutes !== undefined
        ? clampInt(body.defaultSlotMinutes, 5, 240, current.defaultSlotMinutes)
        : current.defaultSlotMinutes,
      reschedulePolicy: {
        minHoursBefore: body.reschedulePolicy?.minHoursBefore !== undefined
          ? clampInt(body.reschedulePolicy.minHoursBefore, 0, 168, current.reschedulePolicy.minHoursBefore)
          : current.reschedulePolicy.minHoursBefore,
      },
      cancellationPolicy: {
        minHoursBefore: body.cancellationPolicy?.minHoursBefore !== undefined
          ? clampInt(body.cancellationPolicy.minHoursBefore, 0, 168, current.cancellationPolicy.minHoursBefore)
          : current.cancellationPolicy.minHoursBefore,
      },
      reminders: {
        t24h: body.reminders?.t24h !== undefined ? coerceBool(body.reminders.t24h, current.reminders.t24h) : current.reminders.t24h,
        t1h: body.reminders?.t1h !== undefined ? coerceBool(body.reminders.t1h, current.reminders.t1h) : current.reminders.t1h,
        noShowFollowup: body.reminders?.noShowFollowup !== undefined
          ? coerceBool(body.reminders.noShowFollowup, current.reminders.noShowFollowup)
          : current.reminders.noShowFollowup,
      },
    };

    const settingsObj =
      org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};
    const nextSettings = { ...settingsObj, schedule: merged };

    await prisma.$executeRaw`
      UPDATE organizations
      SET settings = ${JSON.stringify(nextSettings)}::jsonb,
          "updatedAt" = NOW()
      WHERE id = ${org.id}::uuid
    `;

    return NextResponse.json({ ok: true, schedule: merged });
  } catch (err) {
    console.error("[admin schedule-config PATCH] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
