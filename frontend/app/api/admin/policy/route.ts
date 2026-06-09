import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Org Admin → Settings → Policy tab.
 *
 * Stores tenant policy on `organizations.settings.policy` (JSONB). The shape
 * lives only here — there's no schema migration; settings is a free-form Json
 * column we extend with one new sub-key.
 *
 * GET   /api/admin/policy   → current values + DEFAULTS for any missing field
 * PATCH /api/admin/policy   → save changes (validated, clamped to safe ranges)
 *
 * Driven values:
 *   minPasswordLength       → enforced by /api/auth/change-password + /register
 *   passwordHistory         → "last N" hashes the new password must not match
 *   patientSessionMinutes   → idle-timeout for /patient/* surfaces
 *   clinicalSessionMinutes  → idle-timeout for /clinician|/admin|/auditor|/compliance/*
 */

const DEFAULTS = {
  minPasswordLength: 12,
  passwordHistory: 5,
  patientSessionMinutes: 30,
  clinicalSessionMinutes: 15,
} as const;

interface PolicyShape {
  minPasswordLength: number;
  passwordHistory: number;
  patientSessionMinutes: number;
  clinicalSessionMinutes: number;
}

interface PatchBody {
  minPasswordLength?: number;
  passwordHistory?: number;
  patientSessionMinutes?: number;
  clinicalSessionMinutes?: number;
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

function readPolicy(settings: Prisma.JsonValue | null | undefined): PolicyShape {
  // settings is whatever's on organizations.settings — typically `{}` for a
  // fresh tenant. We pull a `policy` sub-key out if it exists; missing fields
  // fall back to DEFAULTS.
  const obj = settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
  const p = obj.policy && typeof obj.policy === "object" && !Array.isArray(obj.policy)
    ? (obj.policy as Record<string, unknown>)
    : {};
  return {
    minPasswordLength: clampInt(p.minPasswordLength, 8, 128, DEFAULTS.minPasswordLength),
    passwordHistory: clampInt(p.passwordHistory, 0, 50, DEFAULTS.passwordHistory),
    patientSessionMinutes: clampInt(p.patientSessionMinutes, 1, 720, DEFAULTS.patientSessionMinutes),
    clinicalSessionMinutes: clampInt(p.clinicalSessionMinutes, 1, 720, DEFAULTS.clinicalSessionMinutes),
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
    return NextResponse.json({ ok: true, policy: readPolicy(org.settings), defaults: DEFAULTS });
  } catch (err) {
    console.error("[admin policy GET] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const g = await requireOrgAdmin();
  if ("error" in g) return g.error;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  try {
    const [org] = await prisma.$queryRaw<{ id: string; settings: Prisma.JsonValue }[]>`
      SELECT id, settings FROM organizations WHERE slug = ${g.claims.org} LIMIT 1
    `;
    if (!org) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });

    const current = readPolicy(org.settings);
    const merged: PolicyShape = {
      minPasswordLength: clampInt(body.minPasswordLength, 8, 128, current.minPasswordLength),
      passwordHistory: clampInt(body.passwordHistory, 0, 50, current.passwordHistory),
      patientSessionMinutes: clampInt(body.patientSessionMinutes, 1, 720, current.patientSessionMinutes),
      clinicalSessionMinutes: clampInt(body.clinicalSessionMinutes, 1, 720, current.clinicalSessionMinutes),
    };

    // Preserve any non-policy keys already on settings (branding, etc.)
    const settingsObj =
      org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};
    const nextSettings = { ...settingsObj, policy: merged };

    await prisma.$executeRaw`
      UPDATE organizations
      SET settings = ${JSON.stringify(nextSettings)}::jsonb,
          "updatedAt" = NOW()
      WHERE id = ${org.id}::uuid
    `;

    return NextResponse.json({ ok: true, policy: merged });
  } catch (err) {
    console.error("[admin policy PATCH] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
