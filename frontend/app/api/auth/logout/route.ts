import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PENDING_COOKIE, SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  // Stamp `lastActiveAt` to far-past on logout so the messaging surface
  // immediately flips the user from "online" → "last active …" instead of
  // waiting out the 2-minute heartbeat window.
  try {
    const jar = await cookies();
    const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
    if (claims && isDbUid(claims.uid)) {
      await prisma.$executeRaw`
        UPDATE users SET "lastActiveAt" = NULL, "updatedAt" = NOW()
        WHERE id = ${claims.uid}::uuid
      `;
      // Mark this device's session row revoked so it falls out of the
      // /api/me/sessions list immediately.
      if (isDbUid(claims.sid)) {
        await prisma.$executeRaw`
          UPDATE sessions SET "revokedAt" = NOW()
          WHERE id = ${claims.sid}::uuid AND "userId" = ${claims.uid}::uuid AND "revokedAt" IS NULL
        `;
      }
    }
  } catch {
    // Best-effort — never block logout on a presence write failure.
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(PENDING_COOKIE);
  return res;
}
