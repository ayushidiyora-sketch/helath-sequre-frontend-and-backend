import { NextResponse } from "next/server";
import { verifyOnboardToken } from "@/lib/auth";
import { consumeOnboardCred } from "@/lib/password-store";
import { lookupUserByUid } from "@/lib/user-lookup";

export const runtime = "nodejs";

interface OnboardBody {
  token?: string;
}

/**
 * Exchange an onboarding token (emailed to a freshly-provisioned org admin)
 * for the email + one-time temporary password. The token is single-use: the
 * stashed password is deleted on first retrieval, so reusing the link only
 * returns the email — never the password.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: OnboardBody;
  try {
    body = (await req.json()) as OnboardBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const claims = await verifyOnboardToken(body.token);
  if (!claims) {
    return NextResponse.json(
      { ok: false, error: "This onboarding link is invalid or has expired." },
      { status: 400 },
    );
  }
  const user = await lookupUserByUid(claims.uid);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Account not found." }, { status: 400 });
  }

  const password = consumeOnboardCred(claims.jti);
  // Always return the email so the page can fill that field even when the
  // link has been used before — but only return the password on the first
  // click. `consumed: true` means the user should reset via /forgot-password.
  return NextResponse.json({
    ok: true,
    email: user.email,
    name: user.name,
    password: password ?? null,
    consumed: password === undefined,
  });
}
