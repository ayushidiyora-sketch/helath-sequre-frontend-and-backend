import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const runtime = "nodejs";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Returns the current session for header personalization. 401 when missing. */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    user: {
      uid: claims.uid,
      name: claims.name,
      email: claims.email,
      role: claims.role,
      org: claims.org,
      initials: initialsFromName(claims.name),
    },
  });
}
