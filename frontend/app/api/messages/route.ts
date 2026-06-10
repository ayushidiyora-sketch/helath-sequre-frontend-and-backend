import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, sendActionEmail, sendActionSms } from "@/lib/notify";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AttachmentJson {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

interface MessageRow {
  id: string;
  clinicianId: string;
  patientId: string;
  senderRole: string;
  body: string;
  attachments: unknown;
  sentAt: Date;
  readAt: Date | null;
}

function readAttachments(raw: unknown): AttachmentJson[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is AttachmentJson => {
    if (!a || typeof a !== "object") return false;
    const o = a as Record<string, unknown>;
    return typeof o.name === "string" && typeof o.mimeType === "string" && typeof o.size === "number" && typeof o.dataUrl === "string";
  });
}

function shape(r: MessageRow, mePerspective: "clinician" | "patient") {
  return {
    id: r.id,
    clinicianId: r.clinicianId,
    patientId: r.patientId,
    senderRole: r.senderRole,
    fromMe: r.senderRole === mePerspective,
    body: r.body,
    attachments: readAttachments(r.attachments),
    sentAt: r.sentAt.toISOString(),
    readAt: r.readAt ? r.readAt.toISOString() : null,
  };
}

/**
 * GET /api/messages?withUserId=<uuid>
 * Returns the conversation between the signed-in user and the other party.
 * `withUserId` is the *other* participant's id (a patient if I'm clinician, a
 * clinician if I'm patient).
 */
export async function GET(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, messages: [] });

  const url = new URL(req.url);
  const withUserId = url.searchParams.get("withUserId") ?? "";
  if (!UUID_RE.test(withUserId))
    return NextResponse.json({ ok: false, error: "Invalid withUserId." }, { status: 400 });

  const isClinician = claims.role === "Clinician";
  const isPatient = claims.role === "Patient";
  if (!isClinician && !isPatient)
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician or Patient only." }, { status: 403 });

  const clinicianId = isClinician ? claims.uid : withUserId;
  const patientId = isPatient ? claims.uid : withUserId;

  const rows = await prisma.$queryRaw<MessageRow[]>`
    SELECT id, "clinicianId", "patientId", "senderRole", body, attachments, "sentAt", "readAt"
    FROM messages
    WHERE "clinicianId" = ${clinicianId}::uuid
      AND "patientId"   = ${patientId}::uuid
    ORDER BY "sentAt" ASC
    LIMIT 500
  `;

  // Mark messages from the other party as read, now that the recipient has
  // opened the thread.
  const otherRole = isClinician ? "patient" : "clinician";
  await prisma.$executeRaw`
    UPDATE messages SET "readAt" = NOW(), "updatedAt" = NOW()
    WHERE "clinicianId" = ${clinicianId}::uuid
      AND "patientId"   = ${patientId}::uuid
      AND "senderRole" = ${otherRole}
      AND "readAt" IS NULL
  `;

  return NextResponse.json({
    ok: true,
    messages: rows.map((r) => shape(r, isClinician ? "clinician" : "patient")),
  });
}

interface PostBody {
  toUserId?: string;
  body?: string;
  attachments?: AttachmentJson[];
}

const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "application/", "text/"];
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB per file
const MAX_ATTACHMENTS_PER_MESSAGE = 5;

/**
 * POST /api/messages
 * Body: { toUserId, body }
 * Send a message to the other participant. Sender is taken from the session,
 * roles are validated so a Clinician must address a Patient and vice-versa.
 */
export async function POST(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!isDbUid(claims.uid))
    return NextResponse.json({ ok: false, error: "Demo session — messages require a real account." }, { status: 400 });

  const isClinician = claims.role === "Clinician";
  const isPatient = claims.role === "Patient";
  if (!isClinician && !isPatient)
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician or Patient only." }, { status: 403 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const toUserId = body.toUserId?.trim() ?? "";
  if (!UUID_RE.test(toUserId))
    return NextResponse.json({ ok: false, error: "Invalid toUserId." }, { status: 400 });
  const text = body.body?.trim() ?? "";
  const rawAtts = Array.isArray(body.attachments) ? body.attachments : [];
  if (text.length === 0 && rawAtts.length === 0)
    return NextResponse.json({ ok: false, error: "Message body or attachment is required." }, { status: 400 });
  if (text.length > 5000)
    return NextResponse.json({ ok: false, error: "Message too long (5000 char max)." }, { status: 400 });

  // Validate + normalize attachments.
  if (rawAtts.length > MAX_ATTACHMENTS_PER_MESSAGE)
    return NextResponse.json({ ok: false, error: `Max ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message.` }, { status: 400 });
  const attachments: AttachmentJson[] = [];
  for (const a of rawAtts) {
    if (!a || typeof a !== "object")
      return NextResponse.json({ ok: false, error: "Invalid attachment." }, { status: 400 });
    const name = typeof a.name === "string" ? a.name.trim() : "";
    const mimeType = typeof a.mimeType === "string" ? a.mimeType : "";
    const size = typeof a.size === "number" && Number.isFinite(a.size) ? a.size : -1;
    const dataUrl = typeof a.dataUrl === "string" ? a.dataUrl : "";
    if (!name || !mimeType || size < 0 || !dataUrl.startsWith("data:"))
      return NextResponse.json({ ok: false, error: "Attachment must have name, mimeType, size, and a data: URL." }, { status: 400 });
    if (size > MAX_ATTACHMENT_BYTES)
      return NextResponse.json({ ok: false, error: `Attachment "${name}" is over 5 MB.` }, { status: 400 });
    if (!ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p)))
      return NextResponse.json({ ok: false, error: `Attachment "${name}" has unsupported type ${mimeType}.` }, { status: 400 });
    attachments.push({ name: name.slice(0, 240), mimeType, size, dataUrl });
  }

  // Validate that the *other* user is the right role + lookup their org.
  const other = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true, roleKind: true, deletedAt: true, organizationId: true },
  });
  if (!other || other.deletedAt)
    return NextResponse.json({ ok: false, error: "Recipient not found." }, { status: 404 });
  if (isClinician && other.roleKind !== "patient")
    return NextResponse.json({ ok: false, error: "Recipients must be patients." }, { status: 400 });
  if (isPatient && other.roleKind !== "clinician")
    return NextResponse.json({ ok: false, error: "Recipients must be clinicians." }, { status: 400 });

  // Resolve clinicianId / patientId / orgId.
  const clinicianId = isClinician ? claims.uid : toUserId;
  const patientId = isPatient ? claims.uid : toUserId;
  // Org = clinician's org (canonical for the conversation), else fall back to
  // the patient's. At least one side must have an org for the row to write.
  const clinicianRow = await prisma.user.findUnique({
    where: { id: clinicianId },
    select: { organizationId: true },
  });
  const orgId = clinicianRow?.organizationId ?? other.organizationId;
  if (!orgId)
    return NextResponse.json({ ok: false, error: "No tenant on the conversation." }, { status: 400 });

  const attachmentsJson = JSON.stringify(attachments);
  const inserted = await prisma.$queryRaw<{ id: string; sentAt: Date }[]>`
    INSERT INTO messages
      (id, "clinicianId", "patientId", "organizationId", "senderRole", body, attachments, "sentAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), ${clinicianId}::uuid, ${patientId}::uuid,
       ${orgId}::uuid, ${isClinician ? "clinician" : "patient"},
       ${text}, ${attachmentsJson}::jsonb, NOW(), NOW(), NOW())
    RETURNING id, "sentAt"
  `;

  // Notify the recipient of the new message (email + opt-in SMS), gated by their
  // "messages" preference. Best-effort — never blocks the send.
  try {
    const ctx = await prisma.$queryRaw<{
      toEmail: string | null; toPhone: string | null; toFirst: string | null;
      fromFirst: string | null; fromLast: string | null; orgName: string | null;
    }[]>`
      SELECT t.email AS "toEmail", t.phone AS "toPhone", t."firstName" AS "toFirst",
             f."firstName" AS "fromFirst", f."lastName" AS "fromLast", o.name AS "orgName"
      FROM users t
      LEFT JOIN users f         ON f.id = ${claims.uid}::uuid
      LEFT JOIN organizations o ON o.id = ${orgId}::uuid
      WHERE t.id = ${toUserId}::uuid LIMIT 1
    `;
    const cx = ctx[0];
    if (cx?.toEmail) {
      const senderName = isClinician
        ? `Dr. ${[cx.fromFirst, cx.fromLast].filter(Boolean).join(" ")}`.trim()
        : ([cx.fromFirst, cx.fromLast].filter(Boolean).join(" ").trim() || "Your patient");
      const portal = `${appBaseUrl()}${isClinician ? "/patient/messages" : "/clinician/messages"}`;
      const snippet = text ? (text.length > 140 ? `${text.slice(0, 140)}…` : text) : "Sent you an attachment";
      const orgName = cx.orgName ?? "HealthSecure";
      await sendActionEmail({
        orgId,
        to: cx.toEmail,
        categoryKey: "messages",
        slug: "new-message",
        vars: {
          "patient.first_name": cx.toFirst?.trim() || "there",
          "sender.name": senderName,
          "organization.name": orgName,
          action_url: portal,
        },
        fallbackSubject: `New secure message from ${senderName}`,
        fallbackText:
          `Hi ${cx.toFirst?.trim() || "there"},\n\n` +
          `${senderName} sent you a secure message:\n\n"${snippet}"\n\n` +
          `Open your portal to read & reply: ${portal}\n\n— ${orgName}`,
      });
      await sendActionSms({
        toPhone: cx.toPhone,
        recipientEmail: cx.toEmail,
        categoryKey: "messages",
        text: `${orgName}: new secure message from ${senderName}. Open your portal to read it.`,
      });
    }
  } catch (err) {
    console.error("[messages] recipient notify failed", err);
  }

  return NextResponse.json(
    {
      ok: true,
      message: {
        id: inserted[0].id,
        clinicianId,
        patientId,
        senderRole: isClinician ? "clinician" : "patient",
        fromMe: true,
        body: text,
        attachments,
        sentAt: inserted[0].sentAt.toISOString(),
        readAt: null,
      },
    },
    { status: 201 },
  );
}

