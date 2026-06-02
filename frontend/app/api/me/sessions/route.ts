import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface Row {
  id: string;
  device: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  issuedAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

function shape(r: Row, currentSid: string) {
  return {
    id: r.id,
    device: r.device ?? "Unknown device",
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    issuedAt: r.issuedAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    isCurrent: r.id === currentSid,
  };
}

/** List the signed-in user's active sessions (not expired, not revoked). */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, sessions: [] });

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, device, "ipAddress", "userAgent",
           "issuedAt", "lastSeenAt", "expiresAt", "revokedAt"
    FROM sessions
    WHERE "userId" = ${claims.uid}::uuid
      AND "revokedAt" IS NULL
      AND "expiresAt" > NOW()
    ORDER BY "lastSeenAt" DESC
    LIMIT 50
  `;
  return NextResponse.json({
    ok: true,
    sessions: rows.map((r) => shape(r, claims.sid)),
    currentSid: claims.sid,
  });
}

/**
 * Revoke a single session by id, OR all sessions except the current one when
 * `?scope=others` is set. The cookie-bound session is preserved unless its
 * id is explicitly passed.
 */
export async function DELETE(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!isDbUid(claims.uid))
    return NextResponse.json({ ok: false, error: "Demo session — sessions aren't tracked in the DB." }, { status: 400 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const id = url.searchParams.get("id");

  if (scope === "others") {
    await prisma.$executeRaw`
      UPDATE sessions SET "revokedAt" = NOW()
      WHERE "userId" = ${claims.uid}::uuid
        AND id <> ${claims.sid}::uuid
        AND "revokedAt" IS NULL
    `;
    return NextResponse.json({ ok: true });
  }

  if (!id || !isDbUid(id))
    return NextResponse.json({ ok: false, error: "Invalid session id." }, { status: 400 });
  // Also accept id === current sid — let the user kill their own session if
  // they want. The JWT cookie itself remains valid until expiry, but at least
  // the row is marked revoked.
  await prisma.$executeRaw`
    UPDATE sessions SET "revokedAt" = NOW()
    WHERE id = ${id}::uuid AND "userId" = ${claims.uid}::uuid
  `;
  return NextResponse.json({ ok: true });
}

