/**
 * Server-only email transport. Used by the demo auth routes to deliver the
 * OTP and welcome emails. Must not be imported from client code or the Edge
 * runtime — call only from `runtime = "nodejs"` route handlers.
 *
 * Supported transports:
 *   - resend   — Resend REST API   (RESEND_API_KEY)
 *   - sendgrid — SendGrid REST API (SENDGRID_API_KEY)
 *   - smtp     — Nodemailer SMTP   (SMTP_HOST/USER/PASS)
 *   - twilio   — Twilio Programmable SMS (TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM)
 *                Note: SMS only — body becomes the SMS text, subject is dropped.
 *
 * Callers may supply a `prefer` list of transports (per-tenant integration
 * toggles). The first transport in `prefer` that has credentials configured
 * is used. If none match, sendMail falls back to: resend → smtp → none.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { emailBrandHeader } from "@/lib/brand";

export type Transport = "resend" | "sendgrid" | "smtp" | "twilio";

interface SendArgs {
  to: string;
  /** E.164 phone number, only required when "twilio" is in `prefer`. */
  toPhone?: string;
  subject: string;
  text: string;
  html?: string;
  /** Ordered preference list. First configured transport wins. */
  prefer?: Transport[];
}

interface AttemptRecord {
  via: Transport;
  /** "skipped" = credentials missing; "failed" = transport tried but errored; "ok" = success. */
  outcome: "skipped" | "failed" | "ok";
  error?: string;
}

interface SendResult {
  ok: boolean;
  via: Transport | "none";
  error?: string;
  /** Ordered list of every transport that was considered for this send.
   *  Populated by `sendMail`; per-transport helpers return without it and
   *  `sendMail` fills the field before returning. */
  attempts?: AttemptRecord[];
}

function resendKey(): string | undefined {
  const k = process.env.RESEND_API_KEY?.trim();
  return k ? k : undefined;
}
function sendgridKey(): string | undefined {
  const k = process.env.SENDGRID_API_KEY?.trim();
  return k ? k : undefined;
}
function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}
function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM?.trim(),
  );
}

function transportConfigured(t: Transport): boolean {
  switch (t) {
    case "resend":
      return !!resendKey();
    case "sendgrid":
      return !!sendgridKey();
    case "smtp":
      return smtpConfigured();
    case "twilio":
      return twilioConfigured();
  }
}

function fromAddress(): string {
  const explicit = process.env.EMAIL_FROM?.trim();
  if (explicit) return explicit;
  const smtpUser = process.env.SMTP_USER?.trim();
  if (smtpConfigured() && smtpUser) return `HealthSecure Portal <${smtpUser}>`;
  return "HealthSecure Portal <onboarding@resend.dev>";
}

/**
 * Per-transport sender override. Each free-tier provider has a different
 * verification model:
 *  - Resend: must use `onboarding@resend.dev` (sandbox) OR a verified domain
 *  - SendGrid: must match a verified Single Sender or domain
 *
 * Without overrides, a single `EMAIL_FROM` cannot satisfy both at once.
 * `RESEND_FROM` / `SENDGRID_FROM` let each provider use its own valid sender.
 */
function resendFrom(): string {
  return process.env.RESEND_FROM?.trim() || "HealthSecure Portal <onboarding@resend.dev>";
}
function sendgridFrom(): string {
  return process.env.SENDGRID_FROM?.trim() || fromAddress();
}

export function mailerConfigured(): boolean {
  return Boolean(resendKey()) || smtpConfigured() || Boolean(sendgridKey());
}

let cachedTransporter: Transporter | null = null;
function getSmtpTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  const port = Number(process.env.SMTP_PORT ?? 587);
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cachedTransporter;
}

async function sendViaResend(args: SendArgs, key: string): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: resendFrom(),
        to: [args.to],
        subject: args.subject,
        text: args.text,
        ...(args.html ? { html: args.html } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, via: "resend", error: `${res.status}: ${await res.text()}` };
    return { ok: true, via: "resend" };
  } catch (err) {
    return { ok: false, via: "resend", error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendViaSendGrid(args: SendArgs, key: string): Promise<SendResult> {
  try {
    // SendGrid wants the from address as { email, name }. Parse "Name <email>" pattern.
    const fromRaw = sendgridFrom();
    const m = /^(.*?)\s*<([^>]+)>$/.exec(fromRaw);
    const from = m ? { email: m[2].trim(), name: m[1].trim() || undefined } : { email: fromRaw };

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: args.to }] }],
        from,
        subject: args.subject,
        content: [
          { type: "text/plain", value: args.text },
          ...(args.html ? [{ type: "text/html", value: args.html }] : []),
        ],
      }),
      cache: "no-store",
    });
    // SendGrid returns 202 Accepted on success.
    if (res.status !== 202)
      return { ok: false, via: "sendgrid", error: `${res.status}: ${await res.text()}` };
    return { ok: true, via: "sendgrid" };
  } catch (err) {
    return { ok: false, via: "sendgrid", error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendViaSmtp(args: SendArgs): Promise<SendResult> {
  try {
    const transporter = getSmtpTransporter();
    await transporter.sendMail({
      from: fromAddress(),
      to: args.to,
      subject: args.subject,
      text: args.text,
      ...(args.html ? { html: args.html } : {}),
    });
    return { ok: true, via: "smtp" };
  } catch (err) {
    return { ok: false, via: "smtp", error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendViaTwilio(args: SendArgs): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM?.trim();
  if (!sid || !token || !from) {
    return { ok: false, via: "twilio", error: "Twilio not configured (TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM)" };
  }
  if (!args.toPhone) {
    return { ok: false, via: "twilio", error: "Twilio requires a `toPhone` (E.164) — no phone on recipient" };
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({ From: from, To: args.toPhone, Body: args.text }).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, via: "twilio", error: `${res.status}: ${await res.text()}` };
    return { ok: true, via: "twilio" };
  } catch (err) {
    return { ok: false, via: "twilio", error: err instanceof Error ? err.message : String(err) };
  }
}

async function attempt(t: Transport, args: SendArgs): Promise<SendResult> {
  switch (t) {
    case "resend": {
      const k = resendKey();
      if (!k) return { ok: false, via: "resend", error: "RESEND_API_KEY not set" };
      return sendViaResend(args, k);
    }
    case "sendgrid": {
      const k = sendgridKey();
      if (!k) return { ok: false, via: "sendgrid", error: "SENDGRID_API_KEY not set" };
      return sendViaSendGrid(args, k);
    }
    case "smtp":
      if (!smtpConfigured())
        return { ok: false, via: "smtp", error: "SMTP_HOST/USER/PASS not set" };
      return sendViaSmtp(args);
    case "twilio":
      return sendViaTwilio(args);
  }
}

/**
 * Send a message via the first configured transport in `prefer`, or fall
 * back to `resend → smtp → none` when `prefer` is omitted/empty.
 *
 * Returns the result of the successful transport. If every preferred
 * transport fails, returns the LAST error so the caller can surface it.
 */
export async function sendMail(args: SendArgs): Promise<SendResult> {
  // Build the candidate order. `prefer` always comes first (in user-given
  // order), then sensible default fallbacks not already covered.
  // Resend leads the fallbacks because it has the smallest per-message
  // latency for the operator's own mailbox; SendGrid kicks in next when
  // Resend's sandbox rejects a non-signup recipient.
  const preferred = args.prefer ?? [];
  const fallbacks: Transport[] = ["resend", "sendgrid", "smtp"];
  const seen = new Set<Transport>();
  const order: Transport[] = [];
  for (const t of [...preferred, ...fallbacks]) {
    if (!seen.has(t)) {
      seen.add(t);
      order.push(t);
    }
  }

  // Twilio is SMS-only — only try it when explicitly preferred AND a phone is given.
  const effective = order.filter((t) => t !== "twilio" || args.prefer?.includes("twilio"));

  const attempts: AttemptRecord[] = [];
  let lastFailure: SendResult | null = null;

  for (const t of effective) {
    if (!transportConfigured(t)) {
      attempts.push({ via: t, outcome: "skipped", error: `${t} not configured` });
      console.warn(`[mail] ${t} preferred but not configured — skipping`);
      continue;
    }
    const result = await attempt(t, args);
    if (result.ok) {
      attempts.push({ via: t, outcome: "ok" });
      return { ...result, attempts };
    }
    attempts.push({ via: t, outcome: "failed", error: result.error });
    console.warn(`[mail] ${t} failed: ${result.error}`);
    lastFailure = result;
  }

  if (lastFailure) return { ...lastFailure, attempts };
  // No transport was ever attempted — every preferred one was unconfigured.
  return {
    ok: false,
    via: attempts[0]?.via ?? "none",
    error:
      attempts.length > 0
        ? `No configured transport. Preferred but missing credentials: ${attempts.map((a) => a.via).join(", ")}`
        : "No mail transport configured",
    attempts,
  };
}

/**
 * Translate per-tenant integration toggles into a transport preference list.
 * Twilio is SMS-only — when ON, it is the FIRST attempt; if it fails (or no
 * phone), the next preferred transport handles the email.
 */
export function transportsFromIntegrations(flags: {
  sendgrid?: boolean;
  twilioSms?: boolean;
  customSmtp?: boolean;
}): Transport[] {
  const list: Transport[] = [];
  if (flags.twilioSms) list.push("twilio");
  if (flags.customSmtp) list.push("smtp");
  if (flags.sendgrid) list.push("sendgrid");
  return list;
}

interface WelcomeEmailArgs {
  name: string;
  tenantName: string;
  email: string;
  password: string;
  loginUrl: string;
}

export function welcomeEmail(args: WelcomeEmailArgs): { subject: string; text: string; html: string } {
  const subject = `Welcome to HealthSecure — your ${args.tenantName} account is ready`;
  const text = [
    `HealthSecure Portal`,
    ``,
    `Welcome, ${args.name}`,
    ``,
    `Your HealthSecure account for "${args.tenantName}" has been provisioned. You have been added as the Org Admin for this organization.`,
    ``,
    `Sign-in URL: ${args.loginUrl}`,
    `Email:       ${args.email}`,
    `Password:    ${args.password}`,
    ``,
    `For your security, change this password the first time you sign in.`,
    `The link above takes you to the staff portal. After your password you will be prompted for a 6-digit verification code by email.`,
    ``,
    `If you did not expect this email, ignore it and report it to your platform operator.`,
    ``,
    `— This is an automated security message. All sign-in activity is audit-logged.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to HealthSecure</title>
</head>
<body style="margin:0;padding:24px 12px;background:#eff3f4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <tr>
      <td style="background:#0f5b66;padding:18px 28px">
        ${emailBrandHeader()}
      </td>
    </tr>
    <tr>
      <td style="padding:28px 28px 8px">
        <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.25">Welcome, ${escapeHtml(args.name)}</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#475569">Your HealthSecure account for <strong style="color:#0f172a">${escapeHtml(args.tenantName)}</strong> has been provisioned. You have been added as the <strong style="color:#0f172a">Org Admin</strong> for this organization.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 18px;background:#e6f3f4;border:1px solid #b6dde0;border-radius:10px">
          <tr><td style="padding:14px 18px">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#0f5b66;margin-bottom:8px">Sign-in details</div>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size:13px;line-height:1.7">
              <tr>
                <td style="color:#475569;width:90px">Email</td>
                <td style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#0f172a;font-weight:600;word-break:break-all">${escapeHtml(args.email)}</td>
              </tr>
              <tr>
                <td style="color:#475569">Password</td>
                <td style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#0f172a;font-weight:600;word-break:break-all">${escapeHtml(args.password)}</td>
              </tr>
            </table>
          </td></tr>
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td align="center" style="padding:4px 0 18px">
              <a href="${escapeHtml(args.loginUrl)}" style="display:inline-block;padding:13px 28px;background:#0f5b66;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:0.2px">Open the sign-in page</a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#475569">For your security, <strong style="color:#0f172a">change this password the first time you sign in</strong>. After your password you will be prompted for a 6-digit verification code emailed to you.</p>
        <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#475569">If you did not expect this email, ignore it and report it to your platform operator.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px 18px;background:#f8fafc;border-top:1px solid #e2e8f0">
        <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5">This is an automated security message. All sign-in activity is audit-logged.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function resetEmail(link: string, name?: string): { subject: string; text: string; html: string } {
  const subject = `Reset your HealthSecure password`;
  const greet = name ? `Hi ${name},` : `Hi,`;
  const text = [
    `HealthSecure Portal`,
    ``,
    `Reset your password`,
    ``,
    greet,
    ``,
    `We received a request to reset the password on your HealthSecure account.`,
    `Open the link below to choose a new password. It expires in 30 minutes.`,
    ``,
    link,
    ``,
    `If you did not request this, you can safely ignore this email — your password will stay the same.`,
    ``,
    `— This is an automated security message. All sign-in activity is audit-logged.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset your HealthSecure password</title>
</head>
<body style="margin:0;padding:24px 12px;background:#eff3f4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <tr>
      <td style="background:#0f5b66;padding:18px 28px">
        ${emailBrandHeader()}
      </td>
    </tr>
    <tr>
      <td style="padding:28px 28px 8px">
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.25">Reset your password</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#475569">${greet} we received a request to reset the password on your HealthSecure account. Click the button below to choose a new one.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td align="center" style="padding:8px 0 18px">
              <a href="${link}" style="display:inline-block;padding:13px 28px;background:#0f5b66;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:0.2px">Reset password</a>
            </td>
          </tr>
        </table>
        <p style="margin:6px 0 4px;font-size:12px;color:#64748b">Or paste this link into your browser:</p>
        <p style="margin:0 0 18px;font-size:12px;line-height:1.5;word-break:break-all;color:#0f5b66"><a href="${link}" style="color:#0f5b66">${link}</a></p>
        <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#475569">This link expires in <strong style="color:#0f172a">30 minutes</strong>. If you did not request this, you can safely ignore this email &mdash; your password will stay the same.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px 18px;background:#f8fafc;border-top:1px solid #e2e8f0">
        <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5">This is an automated security message. All sign-in activity is audit-logged.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}

export function otpEmail(code: string): { subject: string; text: string; html: string } {
  const subject = `HealthSecure verification code ${code}`;
  const text = [
    `HealthSecure Portal`,
    ``,
    `Verify it's you`,
    ``,
    `Use the code below to finish signing in to your HealthSecure account.`,
    ``,
    `    ${code.split("").join(" ")}`,
    ``,
    `This code expires in 10 minutes. Never share it with anyone — HealthSecure staff will never ask you for it.`,
    ``,
    `If you did not try to sign in, you can safely ignore this email.`,
    ``,
    `— This is an automated security message. All sign-in activity is audit-logged.`,
  ].join("\n");

  const spacedCode = code
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;min-width:36px;padding:0 6px;color:#0f5b66">${d}</span>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>HealthSecure verification code</title>
</head>
<body style="margin:0;padding:24px 12px;background:#eff3f4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <tr>
      <td style="background:#0f5b66;padding:18px 28px">
        ${emailBrandHeader()}
      </td>
    </tr>
    <tr>
      <td style="padding:28px 28px 8px">
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.25">Verify it&rsquo;s you</h1>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#475569">Use the code below to finish signing in to your HealthSecure account.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td align="center" style="padding:0">
              <div style="display:inline-block;padding:20px 20px;background:#e6f3f4;border:2px dashed #5fa6ad;border-radius:10px;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:700;letter-spacing:2px;color:#0f5b66;white-space:nowrap">
                ${spacedCode}
              </div>
            </td>
          </tr>
        </table>
        <p style="margin:22px 0 12px;font-size:13px;line-height:1.6;color:#475569">This code expires in <strong style="color:#0f172a">10 minutes</strong>. Never share it with anyone &mdash; HealthSecure staff will never ask you for it.</p>
        <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#475569">If you did not try to sign in, you can safely ignore this email.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px 18px;background:#f8fafc;border-top:1px solid #e2e8f0">
        <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5">This is an automated security message. All sign-in activity is audit-logged.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
