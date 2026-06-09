import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { RoleKind, UserStatus } from "@prisma/client";
import { SESSION_COOKIE, verifySession, signResetToken, INVITE_TTL_SECONDS } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mailerConfigured, sendMail } from "@/lib/mail";
import { newJti } from "@/lib/password-store";
import { renderTemplate } from "@/lib/notification-template";

export const runtime = "nodejs";

interface InviteBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
}

/**
 * Invite a patient. Creates the patient user (status=invited), generates a
 * 72-hour accept link (→ /reset-password where they set their password and the
 * account flips to active), renders the org's editable "welcome-invitation"
 * notification template, and emails it. The invitation copy is fully driven by
 * the admin-edited template (subject/body with {{patient.first_name}},
 * {{organization.name}}, {{action_url}}, {{clinic.name}}).
 */
export async function POST(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Org Admin")
    return NextResponse.json({ ok: false, error: "Forbidden — Org Admin only." }, { status: 403 });

  let body: InviteBody;
  try { body = (await req.json()) as InviteBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!firstName) return NextResponse.json({ ok: false, error: "First name is required." }, { status: 400 });
  if (!/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ ok: false, error: "A valid email is required to send an invitation." }, { status: 400 });

  // Resolve the admin's tenant.
  const orgRows = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT o.id::text AS id, o.name FROM users u
    JOIN organizations o ON o.id = u."organizationId"
    WHERE u.id = ${claims.uid}::uuid LIMIT 1
  `;
  const org = orgRows[0];
  if (!org) return NextResponse.json({ ok: false, error: "No tenant on your account." }, { status: 400 });

  // Email must be unique across users.
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) return NextResponse.json({ ok: false, error: `"${email}" is already in use by another account.` }, { status: 409 });

  // Create the patient (invited). A throwaway hash holds the slot until they
  // set their own password via the accept link.
  const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 12);
  let patient;
  try {
    patient = await prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        passwordHash,
        firstName,
        lastName: lastName || "",
        phone: body.phone?.trim() || null,
        gender: body.gender?.trim() || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        roleKind: RoleKind.patient,
        status: UserStatus.invited,
        mfaRequired: false,
      },
      select: { id: true, email: true, firstName: true },
    });
  } catch (err) {
    console.error("[patients/invite] create failed:", err);
    return NextResponse.json({ ok: false, error: "Could not create the patient record." }, { status: 500 });
  }

  // 72-hour accept link → patient sets their password on /reset-password.
  const token = await signResetToken({ uid: patient.id, email, jti: newJti() }, INVITE_TTL_SECONDS);
  const origin = new URL(req.url).origin;
  const actionUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

  // Render the admin-editable invitation template.
  const tpl = await renderTemplate(org.id, "welcome-invitation", {
    "patient.first_name": firstName,
    "patient.last_name": lastName,
    "organization.name": org.name,
    "clinic.name": org.name,
    action_url: actionUrl,
  });
  const subject = tpl.found && tpl.subject ? tpl.subject : `Welcome to ${org.name} · accept your invitation`;
  const text = tpl.found
    ? tpl.body
    : `Hi ${firstName},\n\n${org.name} has invited you to the HealthSecure patient portal.\n\nAccept your invitation here (link expires in 72 hours):\n${actionUrl}\n`;
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.6;color:#18181b">${text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, "<br>")}</div>`;

  let mailSent = false;
  let mailVia: string | undefined;
  let mailError: string | undefined;
  if (mailerConfigured()) {
    const result = await sendMail({ to: email, subject, text, html });
    mailSent = result.ok;
    mailVia = result.via;
    if (!result.ok) mailError = result.error;
  }

  return NextResponse.json({
    ok: true,
    patientId: patient.id,
    templateUsed: tpl.found,
    mailSent,
    mailVia,
    mailError,
    // Dev fallback so the invite link is testable without a live mailbox.
    ...(mailSent ? {} : { actionUrl }),
  }, { status: 201 });
}
