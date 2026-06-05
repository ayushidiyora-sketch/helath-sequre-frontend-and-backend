/**
 * Calendar export / sync helpers.
 *
 * Pure client-side iCalendar (.ics) generation plus deep-links to add an event
 * to Google Calendar or Outlook on the web. No backend or third-party SDK —
 * appointments become portable calendar entries the patient/clinician can pull
 * into whatever calendar they use.
 */

export interface CalendarEvent {
  /** Stable id — used for the ICS UID. */
  id: string;
  title: string;
  /** Event start. */
  start: Date;
  durationMinutes: number;
  location?: string;
  description?: string;
}

/** "9:30 AM" / "13:30" → minutes since midnight, or null if unparseable. */
export function parseTime12(label: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(label.trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Combine an ISO date ("2026-05-21") + a time label ("10:00 AM") into a Date. */
export function toEventStart(isoDate: string, timeLabel: string): Date {
  const mins = parseTime12(timeLabel) ?? 9 * 60;
  const d = new Date(`${isoDate}T00:00:00`);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

/** Format a Date as an iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ. */
function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escape per RFC 5545 (commas, semicolons, backslashes, newlines). */
function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function eventEnd(e: CalendarEvent): Date {
  return new Date(e.start.getTime() + e.durationMinutes * 60_000);
}

/** Build a full VCALENDAR document for one or more events. */
export function buildICS(events: CalendarEvent[]): string {
  const now = icsStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HealthSecure Portal//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@healthsecure`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsStamp(e.start)}`,
      `DTEND:${icsStamp(eventEnd(e))}`,
      `SUMMARY:${icsEscape(e.title)}`,
    );
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    // 24h + 1h reminders, matching the portal's reminder cadence.
    lines.push(
      "BEGIN:VALARM",
      "TRIGGER:-PT24H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(e.title)}`,
      "END:VALARM",
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(e.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  // RFC 5545 wants CRLF line endings.
  return lines.join("\r\n");
}

/** Trigger a browser download of an .ics file for the given events. */
export function downloadICS(filename: string, events: CalendarEvent[]): void {
  const blob = new Blob([buildICS(events)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Google Calendar "create event" template URL. */
export function googleCalendarUrl(e: CalendarEvent): string {
  const dates = `${icsStamp(e.start)}/${icsStamp(eventEnd(e))}`;
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates,
  });
  if (e.description) p.set("details", e.description);
  if (e.location) p.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** Outlook (live.com) "compose event" URL. */
export function outlookCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    startdt: e.start.toISOString(),
    enddt: eventEnd(e).toISOString(),
    subject: e.title,
  });
  if (e.description) p.set("body", e.description);
  if (e.location) p.set("location", e.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}
