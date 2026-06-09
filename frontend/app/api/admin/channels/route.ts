import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Org Admin → /admin/settings → Channels tab.
 *
 * Persists the tenant's notification channel configuration to
 * `organizations.settings.channels` (JSONB) — same pattern as the policy +
 * schedule sub-keys.
 *
 *   GET   → current values + DEFAULTS
 *   PATCH → partial save (validated, lengths clamped)
 *
 * Shape:
 *   {
 *     email: { enabled, verifiedSender },
 *     sms:   { enabled, senderId, countries },
 *     inApp: { enabled }   -- enabled is forced true server-side (always-on)
 *   }
 *
 * In-app push is always enabled — clients may pass `inApp.enabled:false`
 * but the server clamps it to true, mirroring the UI's "alwaysOn" badge.
 */

interface ChannelShape {
  email: { enabled: boolean; verifiedSender: string };
  sms: { enabled: boolean; senderId: string; countries: number };
  inApp: { enabled: boolean };
}

const DEFAULTS: ChannelShape = {
  email: { enabled: true, verifiedSender: "" },
  sms: { enabled: true, senderId: "", countries: 0 },
  inApp: { enabled: true },
};

function coerceBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function coerceString(v: unknown, max: number, fallback: string): string {
  if (typeof v !== "string") return fallback;
  return v.slice(0, max).trim();
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

function readChannels(settings: Prisma.JsonValue | null | undefined): ChannelShape {
  const obj = settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
  const c = obj.channels && typeof obj.channels === "object" && !Array.isArray(obj.channels)
    ? (obj.channels as Record<string, unknown>)
    : {};

  const e = c.email && typeof c.email === "object" && !Array.isArray(c.email) ? (c.email as Record<string, unknown>) : {};
  const s = c.sms && typeof c.sms === "object" && !Array.isArray(c.sms) ? (c.sms as Record<string, unknown>) : {};
  const i = c.inApp && typeof c.inApp === "object" && !Array.isArray(c.inApp) ? (c.inApp as Record<string, unknown>) : {};

  return {
    email: {
      enabled: coerceBool(e.enabled, DEFAULTS.email.enabled),
      verifiedSender: coerceString(e.verifiedSender, 254, DEFAULTS.email.verifiedSender),
    },
    sms: {
      enabled: coerceBool(s.enabled, DEFAULTS.sms.enabled),
      senderId: coerceString(s.senderId, 32, DEFAULTS.sms.senderId),
      countries: clampInt(s.countries, 0, 250, DEFAULTS.sms.countries),
    },
    // In-app push is always on per platform policy.
    inApp: { enabled: true },
  };
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
    return NextResponse.json({ ok: true, channels: readChannels(org.settings), defaults: DEFAULTS });
  } catch (err) {
    console.error("[admin channels GET] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const g = await requireOrgAdmin();
  if ("error" in g) return g.error;

  let body: Partial<ChannelShape>;
  try {
    body = (await req.json()) as Partial<ChannelShape>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  try {
    const [org] = await prisma.$queryRaw<{ id: string; settings: Prisma.JsonValue }[]>`
      SELECT id, settings FROM organizations WHERE slug = ${g.claims.org} LIMIT 1
    `;
    if (!org) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });

    const current = readChannels(org.settings);
    const merged: ChannelShape = {
      email: {
        enabled: body.email?.enabled !== undefined ? coerceBool(body.email.enabled, current.email.enabled) : current.email.enabled,
        verifiedSender:
          body.email?.verifiedSender !== undefined
            ? coerceString(body.email.verifiedSender, 254, current.email.verifiedSender)
            : current.email.verifiedSender,
      },
      sms: {
        enabled: body.sms?.enabled !== undefined ? coerceBool(body.sms.enabled, current.sms.enabled) : current.sms.enabled,
        senderId:
          body.sms?.senderId !== undefined ? coerceString(body.sms.senderId, 32, current.sms.senderId) : current.sms.senderId,
        countries:
          body.sms?.countries !== undefined ? clampInt(body.sms.countries, 0, 250, current.sms.countries) : current.sms.countries,
      },
      inApp: { enabled: true },
    };

    const settingsObj =
      org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};
    const nextSettings = { ...settingsObj, channels: merged };

    await prisma.$executeRaw`
      UPDATE organizations
      SET settings = ${JSON.stringify(nextSettings)}::jsonb,
          "updatedAt" = NOW()
      WHERE id = ${org.id}::uuid
    `;

    return NextResponse.json({ ok: true, channels: merged });
  } catch (err) {
    console.error("[admin channels PATCH] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
