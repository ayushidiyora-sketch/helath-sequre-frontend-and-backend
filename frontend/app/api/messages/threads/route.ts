import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface ThreadRow {
  otherUserId: string;
  otherFirstName: string;
  otherLastName: string;
  otherDesignation: string | null;
  otherDepartment: string | null;
  otherLastActiveAt: Date | null;
  lastBody: string;
  lastSentAt: Date;
  lastSenderRole: string;
  unreadCount: number | bigint;
}

/**
 * Returns the signed-in user's message threads. A "thread" is the implicit
 * (clinicianId, patientId) pair — DISTINCT on that pair across the messages
 * table yields one row per conversation. Each row carries the most recent
 * message + per-thread unread count.
 *
 *   - Clinician: the "other party" is the patient.
 *   - Patient:   the "other party" is the clinician.
 */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!isDbUid(claims.uid)) return NextResponse.json({ ok: true, threads: [] });

  const isClinician = claims.role === "Clinician";
  const isPatient = claims.role === "Patient";
  if (!isClinician && !isPatient)
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician or Patient only." }, { status: 403 });

  // For each (clinicianId, patientId) pair where I'm a participant, return:
  //   - the other user's identity
  //   - the most recent message body + timestamp + sender role
  //   - unread count (messages from the OTHER role to me where readAt IS NULL)
  // DISTINCT ON keeps one row per pair, ordered by sentAt DESC.
  const rows = isClinician
    ? await prisma.$queryRaw<ThreadRow[]>`
        WITH my AS (
          SELECT * FROM messages WHERE "clinicianId" = ${claims.uid}::uuid
        ),
        last_per_pair AS (
          SELECT DISTINCT ON ("patientId") *
          FROM my
          ORDER BY "patientId", "sentAt" DESC
        )
        SELECT
          lp."patientId" AS "otherUserId",
          u."firstName"  AS "otherFirstName",
          u."lastName"   AS "otherLastName",
          u.designation  AS "otherDesignation",
          u.department   AS "otherDepartment",
          u."lastActiveAt" AS "otherLastActiveAt",
          lp.body        AS "lastBody",
          lp."sentAt"    AS "lastSentAt",
          lp."senderRole" AS "lastSenderRole",
          (SELECT COUNT(*) FROM my
            WHERE my."patientId" = lp."patientId"
              AND my."senderRole" = 'patient'
              AND my."readAt" IS NULL) AS "unreadCount"
        FROM last_per_pair lp
        JOIN users u ON u.id = lp."patientId"
        ORDER BY lp."sentAt" DESC
        LIMIT 100
      `
    : await prisma.$queryRaw<ThreadRow[]>`
        WITH my AS (
          SELECT * FROM messages WHERE "patientId" = ${claims.uid}::uuid
        ),
        last_per_pair AS (
          SELECT DISTINCT ON ("clinicianId") *
          FROM my
          ORDER BY "clinicianId", "sentAt" DESC
        )
        SELECT
          lp."clinicianId" AS "otherUserId",
          u."firstName"    AS "otherFirstName",
          u."lastName"     AS "otherLastName",
          u.designation    AS "otherDesignation",
          u.department     AS "otherDepartment",
          u."lastActiveAt" AS "otherLastActiveAt",
          lp.body          AS "lastBody",
          lp."sentAt"      AS "lastSentAt",
          lp."senderRole"  AS "lastSenderRole",
          (SELECT COUNT(*) FROM my
            WHERE my."clinicianId" = lp."clinicianId"
              AND my."senderRole" = 'clinician'
              AND my."readAt" IS NULL) AS "unreadCount"
        FROM last_per_pair lp
        JOIN users u ON u.id = lp."clinicianId"
        ORDER BY lp."sentAt" DESC
        LIMIT 100
      `;

  const ONLINE_WINDOW_MS = 2 * 60 * 1000; // < 2 min since last heartbeat = online
  const now = Date.now();
  return NextResponse.json({
    ok: true,
    threads: rows.map((r) => {
      const baseName = `${r.otherFirstName} ${r.otherLastName}`.trim();
      const displayName = isClinician ? baseName : `Dr. ${baseName}`;
      const initials = ((r.otherFirstName[0] ?? "") + (r.otherLastName[0] ?? "")).toUpperCase();
      const lastActiveIso = r.otherLastActiveAt ? r.otherLastActiveAt.toISOString() : null;
      const online = r.otherLastActiveAt ? now - r.otherLastActiveAt.getTime() < ONLINE_WINDOW_MS : false;
      return {
        otherUserId: r.otherUserId,
        otherName: displayName,
        otherInitials: initials,
        otherRole: r.otherDesignation ?? r.otherDepartment ?? "Care team",
        otherLastActiveAt: lastActiveIso,
        otherOnline: online,
        lastBody: r.lastBody,
        lastSentAt: r.lastSentAt.toISOString(),
        lastSenderRole: r.lastSenderRole,
        unread: Number(r.unreadCount),
      };
    }),
  });
}
