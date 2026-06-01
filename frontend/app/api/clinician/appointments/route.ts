import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AppointmentStatus } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns the signed-in clinician's appointments. Optional `?from` and `?to`
 * (YYYY-MM-DD, inclusive bounds in local time) narrow the window — used by the
 * Schedule Day tab (from=to=today) and the Week tab (from=Mon, to=Sun).
 */
export async function GET(req: Request) {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Clinician")
    return NextResponse.json({ ok: false, error: "Forbidden — Clinician only." }, { status: 403 });

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  if (fromStr) {
    if (!DATE_RE.test(fromStr))
      return NextResponse.json({ ok: false, error: "Invalid from (YYYY-MM-DD)." }, { status: 400 });
    const [y, m, d] = fromStr.split("-").map(Number);
    fromDate = new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  if (toStr) {
    if (!DATE_RE.test(toStr))
      return NextResponse.json({ ok: false, error: "Invalid to (YYYY-MM-DD)." }, { status: 400 });
    const [y, m, d] = toStr.split("-").map(Number);
    toDate = new Date(y, m - 1, d, 23, 59, 59, 999);
  }

  const rows = await prisma.appointment.findMany({
    where: {
      clinicianId: claims.uid,
      deletedAt: null,
      ...(fromDate || toDate
        ? {
            startsAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      patientName: true,
      patientEmail: true,
      startsAt: true,
      durationMinutes: true,
      room: true,
      status: true,
      notes: true,
    },
  });

  return NextResponse.json({
    ok: true,
    appointments: rows.map((a) => {
      const d = a.startsAt;
      return {
        id: a.id,
        patientName: a.patientName,
        patientEmail: a.patientEmail,
        startsAt: d.toISOString(),
        // Convenient pre-formatted fields so the schedule UI doesn't have to
        // re-parse — store-derived `date` (YYYY-MM-DD, local) and `time`
        // ("9:30 AM") match the patient-store appointment shape too.
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        durationMinutes: a.durationMinutes,
        room: a.room,
        status: a.status,
        mode: a.room === "Telehealth" ? "telehealth" : "in-person",
        notes: a.notes,
        completed: a.status === AppointmentStatus.completed,
      };
    }),
  });
}
