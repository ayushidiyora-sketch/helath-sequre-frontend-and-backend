"use client";

import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  type CalendarEvent,
  downloadICS,
  googleCalendarUrl,
  outlookCalendarUrl,
} from "@/lib/calendar-export";

/**
 * "Add to calendar" dropdown — downloads an .ics file (Apple Calendar, Outlook
 * desktop, any RFC 5545 client) or deep-links to Google / Outlook web. Pass one
 * or more `CalendarEvent`s; multiple events export as a single .ics file (the
 * web deep-links only carry the first event since those endpoints take one).
 */
export function AddToCalendar({
  event,
  filename = "appointment",
  label = "Add to calendar",
  triggerProps,
}: {
  event: CalendarEvent | CalendarEvent[];
  filename?: string;
  label?: string;
  triggerProps?: React.ComponentProps<typeof Button>;
}) {
  const events = Array.isArray(event) ? event : [event];
  if (events.length === 0) return null;
  const first = events[0];
  const multi = events.length > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" {...triggerProps}>
          <CalendarPlus /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{multi ? `${events.length} appointments` : "Add to your calendar"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            downloadICS(filename, events);
            toast.success("Calendar file downloaded", {
              description: multi
                ? `${events.length} appointments · .ics (Apple, Outlook, Google)`
                : ".ics · opens in Apple Calendar, Outlook, Google",
            });
          }}
        >
          <Download /> Download .ics{multi ? ` (${events.length})` : ""}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={googleCalendarUrl(first)} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Google Calendar{multi ? " (first)" : ""}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={outlookCalendarUrl(first)} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Outlook Calendar{multi ? " (first)" : ""}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
