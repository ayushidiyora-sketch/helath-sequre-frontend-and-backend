import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/mfa";

export const runtime = "nodejs";

/**
 * POST /api/super/break-glass/[id]/mfa-verify
 *
 * The +15m re-verification challenge. The operator submits either:
 *   • a 6-digit TOTP code (verified against `users.mfaSecret` via `verifyToken`), or
 *   • the literal string "CONFIRM" — only accepted when the user has no
 *     `mfaSecret` enrolled, so demo accounts can still extend their session.
 *
 * On success, stamps `mfaVerifiedAt = NOW()`. On failure, returns 400 and
 * leaves the column NULL; the lazyExpire sweep in the parent GET will
 * auto-close the session once it crosses `mfaChallengeAt + grace`.
 */

interface Body {
  code?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  if (claims.role !== "Super Admin") {
    return NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!isDbUid(id)) {
    return NextResponse.json({ ok: false, error: "Invalid session id." }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const code = (body.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ ok: false, error: "Enter your TOTP code (or CONFIRM)." }, { status: 400 });
  }

  try {
    const [session] = await prisma.$queryRaw<
      { id: string; status: string; operatorId: string; displayId: string }[]
    >`
      SELECT id, status, "operatorId", "displayId"
      FROM break_glass_sessions WHERE id = ${id}::uuid LIMIT 1
    `;
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }
    if (session.status !== "active") {
      return NextResponse.json(
        { ok: false, error: `Session is already ${session.status}.` },
        { status: 409 },
      );
    }

    const [operator] = await prisma.$queryRaw<{ mfaSecret: string | null }[]>`
      SELECT "mfaSecret" FROM users WHERE id = ${session.operatorId}::uuid LIMIT 1
    `;

    let ok = false;
    if (operator?.mfaSecret) {
      ok = verifyToken({ token: code, secret: operator.mfaSecret });
    } else {
      // Demo fallback: the demo Super Admin has no `mfaSecret` enrolled, so
      // we accept the literal string "CONFIRM" (case-insensitive) as a
      // presence check. Real production deployments will always have
      // mfaSecret set for Super Admins.
      ok = code.toUpperCase() === "CONFIRM";
    }

    if (!ok) {
      return NextResponse.json(
        {
          ok: false,
          error: operator?.mfaSecret
            ? "Code didn't match. Check the time on your phone and retry."
            : "Type CONFIRM to extend the session (no TOTP enrolled).",
        },
        { status: 400 },
      );
    }

    await prisma.$executeRaw`
      UPDATE break_glass_sessions
      SET "mfaVerifiedAt" = NOW(), "updatedAt" = NOW()
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({ ok: true, displayId: session.displayId });
  } catch (err) {
    console.error("[break-glass mfa-verify] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
