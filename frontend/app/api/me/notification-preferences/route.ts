import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Per-user notification preferences. One row per user in `notification_preferences`,
 * `prefs` JSONB holds a `{ [category]: { inApp, email, sms } }` map.
 *
 *   GET /api/me/notification-preferences  → { ok, prefs, role }
 *   PUT /api/me/notification-preferences  → save (upsert by userId)
 *
 * Critical categories (security, incidents) are enforced server-side too: inApp
 * and email are clamped ON for those keys regardless of what the client sends,
 * so a tampered request can't disable them.
 *
 * Demo users (non-UUID uid) get an in-memory pass — preferences "save" without
 * a DB row so the editor still works on demo logins.
 */

type ChannelKey = "inApp" | "email" | "sms";
type ChannelState = Record<ChannelKey, boolean>;
type PrefsMap = Record<string, ChannelState>;

const CRITICAL_KEYS = new Set(["security", "incidents"]);

function coerceChannelState(raw: unknown): ChannelState {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    inApp: typeof obj.inApp === "boolean" ? obj.inApp : true,
    email: typeof obj.email === "boolean" ? obj.email : true,
    sms: typeof obj.sms === "boolean" ? obj.sms : false,
  };
}

function coercePrefs(raw: unknown): PrefsMap {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: PrefsMap = {};
  for (const k of Object.keys(obj)) {
    const ch = coerceChannelState(obj[k]);
    if (CRITICAL_KEYS.has(k)) {
      ch.inApp = true;
      ch.email = true;
    }
    out[k] = ch;
  }
  return out;
}

async function requireSession() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) } as const;
  }
  return { claims } as const;
}

export async function GET() {
  const g = await requireSession();
  if ("error" in g) return g.error;
  const { claims } = g;

  if (!isDbUid(claims.uid)) {
    // Demo user — no DB row, return empty (the client falls back to defaults).
    return NextResponse.json({ ok: true, prefs: {}, role: claims.role });
  }

  try {
    const rows = await prisma.$queryRaw<{ prefs: Prisma.JsonValue; role: string }[]>`
      SELECT prefs, role FROM notification_preferences WHERE "userId" = ${claims.uid}::uuid LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, prefs: {}, role: claims.role });
    }
    return NextResponse.json({
      ok: true,
      prefs: coercePrefs(rows[0].prefs),
      role: rows[0].role,
    });
  } catch (err) {
    console.error("[notification-preferences GET] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const g = await requireSession();
  if ("error" in g) return g.error;
  const { claims } = g;

  let body: { prefs?: unknown; role?: unknown };
  try {
    body = (await req.json()) as { prefs?: unknown; role?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const cleaned = coercePrefs(body.prefs);
  // Trust the session for role attribution — don't let the client claim a
  // different role than their token.
  const role = claims.role ?? "patient";

  if (!isDbUid(claims.uid)) {
    return NextResponse.json({ ok: true, prefs: cleaned, role, demo: true });
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO notification_preferences ("userId", role, prefs)
      VALUES (${claims.uid}::uuid, ${role}, ${JSON.stringify(cleaned)}::jsonb)
      ON CONFLICT ("userId")
      DO UPDATE SET prefs = EXCLUDED.prefs, role = EXCLUDED.role, "updatedAt" = now()
    `;
    return NextResponse.json({ ok: true, prefs: cleaned, role });
  } catch (err) {
    console.error("[notification-preferences PUT] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
