import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Bumps the signed-in user's `lastActiveAt` to NOW(). Called by the app shell
 * roughly every 60s while the tab is open, so the messaging surface can show
 * an "online" green-dot on participants whose heartbeat is recent (< 2 min).
 * No-ops cleanly for demo / non-UUID sessions.
 */
export async function POST() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true });
  await prisma.$executeRaw`
    UPDATE users SET "lastActiveAt" = NOW(), "updatedAt" = NOW()
    WHERE id = ${claims.uid}::uuid
  `;
  return NextResponse.json({ ok: true });
}
