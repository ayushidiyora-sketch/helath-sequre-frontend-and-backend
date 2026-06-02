import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcrypt";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { validatePassword } from "@/lib/password-store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface Body {
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Authenticated password change for the signed-in user. Requires the current
 * password to be supplied + verified before the hash is rewritten. Does not
 * revoke other sessions (the cookie is intentionally left intact so the
 * settings tab stays signed in after the update).
 */
export async function POST(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!isDbUid(claims.uid))
    return NextResponse.json({ ok: false, error: "Demo session — password change requires a real account." }, { status: 400 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const current = body.currentPassword ?? "";
  const next = body.newPassword ?? "";
  if (!current) return NextResponse.json({ ok: false, error: "Enter your current password." }, { status: 400 });
  const policyError = validatePassword(next);
  if (policyError) return NextResponse.json({ ok: false, error: policyError }, { status: 400 });
  if (current === next)
    return NextResponse.json({ ok: false, error: "New password must be different from the current one." }, { status: 400 });

  const me = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { id: true, passwordHash: true },
  });
  if (!me)
    return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });

  const ok = await bcrypt.compare(current, me.passwordHash);
  if (!ok)
    return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 401 });

  const newHash = await bcrypt.hash(next, 12);
  await prisma.user.update({
    where: { id: claims.uid },
    data: { passwordHash: newHash, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
