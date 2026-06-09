import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/me/idle-policy
 *
 * Returns the idle-timeout window in minutes for the signed-in user, derived
 * from the user's tenant policy + their role:
 *   - Patient   → organizations.settings.policy.patientSessionMinutes
 *   - All other → organizations.settings.policy.clinicalSessionMinutes
 *
 * The `IdleTimeout` component (mounted in every role layout) fetches this on
 * mount and uses the value instead of the previous hardcoded 15 min. Defaults
 * apply when the user has no tenant, is a demo account, or the tenant hasn't
 * customised its policy yet.
 */

const DEFAULT_PATIENT_MIN = 30;
const DEFAULT_CLINICAL_MIN = 15;

interface Resp {
  ok: true;
  minutes: number;
  warnSeconds: number;
  /** "patient" | "clinical" — useful for client-side telemetry/debug. */
  scope: "patient" | "clinical";
}

export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);

  // Resolve role + tenant. Anonymous fallback returns 401 — the layouts
  // typically only mount IdleTimeout for signed-in surfaces, but if it
  // somehow renders for an anonymous user the component just uses the
  // default minutes.
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const isPatient = claims.role === "Patient";
  const scope = isPatient ? "patient" : "clinical";
  const fallback = isPatient ? DEFAULT_PATIENT_MIN : DEFAULT_CLINICAL_MIN;

  // Demo users (non-UUID uid) and users without a real tenant fall straight
  // to defaults — they have no row to query.
  if (!isDbUid(claims.uid)) {
    return NextResponse.json<Resp>({
      ok: true,
      minutes: fallback,
      warnSeconds: 30,
      scope,
    });
  }

  try {
    const [row] = await prisma.$queryRaw<
      { settings: Prisma.JsonValue | null }[]
    >`
      SELECT o.settings
      FROM users u
      JOIN organizations o ON o.id = u."organizationId"
      WHERE u.id = ${claims.uid}::uuid
      LIMIT 1
    `;
    let minutes = fallback;
    if (row?.settings && typeof row.settings === "object" && !Array.isArray(row.settings)) {
      const s = row.settings as Record<string, unknown>;
      const p = s.policy && typeof s.policy === "object" && !Array.isArray(s.policy)
        ? (s.policy as Record<string, unknown>)
        : {};
      const key = isPatient ? "patientSessionMinutes" : "clinicalSessionMinutes";
      const raw = p[key];
      const n = typeof raw === "number" ? raw : typeof raw === "string" ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n >= 1 && n <= 720) minutes = Math.floor(n);
    }
    return NextResponse.json<Resp>({ ok: true, minutes, warnSeconds: 30, scope });
  } catch (err) {
    console.error("[me idle-policy] failed:", err);
    // Never fail loud — falling back to defaults is safer than locking the
    // user out of every role layout because of a transient DB blip.
    return NextResponse.json<Resp>({
      ok: true,
      minutes: fallback,
      warnSeconds: 30,
      scope,
    });
  }
}
