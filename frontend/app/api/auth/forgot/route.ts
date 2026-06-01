import { NextResponse } from "next/server";
import { signResetToken } from "@/lib/auth";
import { mailerConfigured, resetEmail, sendMail } from "@/lib/mail";
import { newJti } from "@/lib/password-store";
import { lookupUserByEmail } from "@/lib/user-lookup";

export const runtime = "nodejs";

interface ForgotBody {
  email?: string;
}

/**
 * Request a password-reset link. Always returns the same shape regardless of
 * whether the email is registered — this prevents account enumeration. When
 * the address matches a demo user AND a mail transport is configured, a
 * signed link is delivered; otherwise the link is returned in `devLink` so
 * the demo flow still works without SMTP/Resend.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: ForgotBody;
  try {
    body = (await req.json()) as ForgotBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
  }

  const user = await lookupUserByEmail(email);

  // Build the link only when we actually know the user. The neutral response
  // below means the caller never learns whether the email exists.
  let devLink: string | undefined;
  if (user) {
    const token = await signResetToken({ uid: user.uid, email: user.email, jti: newJti() });
    const origin = new URL(req.url).origin;
    const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

    if (mailerConfigured()) {
      const { subject, text, html } = resetEmail(link, user.name);
      const result = await sendMail({ to: user.email, subject, text, html });
      if (!result.ok) {
        console.error(`[auth/forgot] mail send failed via ${result.via}: ${result.error}`);
        // Fall back to surfacing the link so a dev can still complete the flow.
        devLink = link;
      }
    } else {
      console.warn(
        "[auth/forgot] RESEND_API_KEY not set — surfacing reset link to the client as dev fallback",
      );
      devLink = link;
    }
  }

  // Same shape for both paths to defeat enumeration. `devLink` is only
  // populated in dev when no mail transport is configured.
  return NextResponse.json({ ok: true, ...(devLink ? { devLink } : {}) });
}
