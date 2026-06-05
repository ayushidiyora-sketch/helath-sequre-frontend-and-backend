import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail, mailerConfigured } from "@/lib/mail";

export const runtime = "nodejs";

/**
 * Appointment reminder dispatcher.
 *
 * Schedule an external trigger (Vercel cron, GitHub Actions, or any scheduler)
 * to hit this endpoint every ~15 minutes:
 *
 *   GET/POST /api/cron/appointment-reminders
 *   Header:  x-cron-secret: <CRON_SECRET>
 *
 * It finds reminder rows that are due (scheduledAt <= now, not yet sent) for
 * still-active appointments (confirmed / arrived), emails the patient
 * best-effort, and stamps `sentAt` so it never double-sends. Idempotent: a
 * second call with nothing newly due returns dispatched: 0. The sent rows also
 * surface in the patient's in-app notification feed (see /api/notifications).
 *
 * Auth: if CRON_SECRET is set, the `x-cron-secret` header must match. If it's
 * unset (local dev), the endpoint runs unguarded so it can be exercised by hand.
 */

interface DueRow {
  reminderId: string;
  kind: string;
  appointmentId: string;
  startsAt: Date;
  patientName: string | null;
  patientEmail: string | null;
  clinicianFirstName: string | null;
  clinicianLastName: string | null;
}

function kindLabel(kind: string): string {
  if (kind === "t_24h") return "in 24 hours";
  if (kind === "t_1h") return "in 1 hour";
  return "soon";
}

async function dispatch(req: Request): Promise<NextResponse> {
  const required = process.env.CRON_SECRET;
  if (required) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== required) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const due = await prisma.$queryRaw<DueRow[]>`
    SELECT r.id AS "reminderId", r.kind, r."appointmentId",
           a."startsAt", a."patientName", a."patientEmail",
           c."firstName" AS "clinicianFirstName",
           c."lastName"  AS "clinicianLastName"
    FROM appointment_reminders r
    JOIN appointments a ON a.id = r."appointmentId"
    LEFT JOIN users c   ON c.id = a."clinicianId"
    WHERE r."sentAt" IS NULL
      AND r."scheduledAt" <= NOW()
      AND a."deletedAt" IS NULL
      AND a.status::text IN ('confirmed','arrived')
    ORDER BY r."scheduledAt" ASC
    LIMIT 100
  `;

  let emailed = 0;
  for (const row of due) {
    const doctor = `Dr. ${[row.clinicianFirstName, row.clinicianLastName].filter(Boolean).join(" ").trim()}`.trim();
    const when = row.startsAt.toLocaleString("en-US", {
      weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    // Best-effort email — never blocks stamping the reminder as sent.
    if (row.patientEmail && mailerConfigured()) {
      try {
        await sendMail({
          to: row.patientEmail,
          subject: `Reminder: your appointment ${kindLabel(row.kind)}`,
          text: `Hi ${row.patientName ?? "there"},\n\nThis is a reminder that your appointment with ${doctor} is ${kindLabel(row.kind)} — ${when}.\n\nManage it in your HealthSecure portal.`,
        });
        emailed++;
      } catch {
        // swallow — we still mark the reminder sent so it doesn't loop forever
      }
    }
    await prisma.$executeRaw`
      UPDATE appointment_reminders SET "sentAt" = NOW() WHERE id = ${row.reminderId}::uuid
    `;
  }

  return NextResponse.json({ ok: true, dispatched: due.length, emailed });
}

export async function POST(req: Request) {
  return dispatch(req);
}

export async function GET(req: Request) {
  return dispatch(req);
}
