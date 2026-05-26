"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Mail, User, Clock3, ShieldCheck, Stethoscope, Flame, Copy, ExternalLink } from "lucide-react";

const HOSPITAL_NAME = "City General Hospital";

function randomToken(): string {
  // 24 hex chars — matches the verify-email/invite token format used in the
  // mock API routes. Real backend signs a JWT with tenant+role+exp claims.
  const arr = new Uint8Array(12);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildInviteLink(opts: {
  role: "patient" | "clinician" | "staff";
  email: string;
  hospital?: string;
  clinician?: string;
  name?: string;
}): string {
  const params = new URLSearchParams({
    role: opts.role,
    email: opts.email,
    hospital: opts.hospital ?? HOSPITAL_NAME,
  });
  if (opts.clinician) params.set("clinician", opts.clinician);
  if (opts.name) params.set("name", opts.name);
  return `/invite/${randomToken()}?${params.toString()}`;
}

function InviteLinkPreview({ href, onClose }: { href: string; onClose: () => void }) {
  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}${href}` : href;
  return (
    <div className="space-y-3">
      <p className="text-sm">
        The invitation email would contain this link (demo build — paste it
        into a new tab to walk through the recipient&apos;s flow):
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-2">
        <code className="flex-1 truncate font-mono text-[11px]" title={fullUrl}>
          {fullUrl}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(fullUrl);
            toast.success("Invite link copied");
          }}
          className="rounded-md p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          aria-label="Copy invite link"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button asChild>
          <a href={href} target="_blank" rel="noopener noreferrer">
            Open invite link <ExternalLink />
          </a>
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ============================================================================
   Invite User Dialog (Org Admin / Super Admin)
============================================================================ */
type StaffRole = "Clinician" | "Org Admin" | "Compliance Manager" | "Auditor" | "Care Team";

export function InviteUserDialog({
  triggerLabel = "Invite user",
  triggerProps,
  defaultRole = "Clinician",
  onCreated,
}: {
  triggerLabel?: React.ReactNode;
  triggerProps?: ButtonProps;
  defaultRole?: StaffRole;
  /** Called when the admin clicks Send. Receives the form values so the
   *  parent can persist into a store. The dialog still shows the invite-link
   *  preview after this fires. */
  onCreated?: (opts: { firstName: string; lastName: string; email: string; role: StaffRole; department: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [first, setFirst] = React.useState("");
  const [last, setLast] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<StaffRole>(defaultRole);
  const [dept, setDept] = React.useState("Cardiology");
  const [sentLink, setSentLink] = React.useState<string | null>(null);

  function reset() {
    setFirst("");
    setLast("");
    setEmail("");
    setRole(defaultRole);
    setDept("Cardiology");
    setSentLink(null);
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const linkRole = role === "Clinician" ? "clinician" : "staff";
    const href = buildInviteLink({
      role: linkRole,
      email: email.trim(),
      name: `${first.trim()} ${last.trim()}`.trim(),
    });
    setSentLink(href);
    onCreated?.({
      firstName: first.trim(),
      lastName: last.trim(),
      email: email.trim(),
      role,
      department: dept,
    });
    toast.success("Invitation sent", {
      description: `Email queued to ${email.trim()} · ${role} · ${dept}`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button {...triggerProps}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{sentLink ? "Invitation sent" : "Invite a new user"}</DialogTitle>
          <DialogDescription>
            {sentLink
              ? "Token link emailed. Single-use · expires in 7 days · MFA enforced on first login."
              : "A signed, time-limited invitation token expires in 7 days. The invitee sets a password and enrolls MFA."}
          </DialogDescription>
        </DialogHeader>

        {sentLink ? (
          <InviteLinkPreview href={sentLink} onClose={close} />
        ) : (
          <form className="space-y-4 pt-2" onSubmit={send}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-first">First name</Label>
                <Input id="inv-first" placeholder="Aisha" leadingIcon={<User />} value={first} onChange={(e) => setFirst(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-last">Last name</Label>
                <Input id="inv-last" placeholder="Khan" value={last} onChange={(e) => setLast(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" placeholder="aisha.khan@…" leadingIcon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-role">Role</Label>
                <select
                  id="inv-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
                >
                  <option>Clinician</option>
                  <option>Org Admin</option>
                  <option>Compliance Manager</option>
                  <option>Auditor</option>
                  <option>Care Team</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-dept">Department</Label>
                <select
                  id="inv-dept"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
                >
                  <option>Cardiology</option>
                  <option>General Medicine</option>
                  <option>Pediatrics</option>
                  <option>Radiology</option>
                  <option>Operations</option>
                  <option>Compliance</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-[11px] text-[var(--color-muted-foreground)]">
              <ShieldCheck className="mr-1 inline-block size-3 text-[var(--color-success)]" />
              MFA will be enforced on first login. Token is single-use.
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit">Send invitation</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
   Invite Patient Dialog (Org Admin)
============================================================================ */
export function InvitePatientDialog({
  triggerLabel = "Invite patient",
  triggerProps,
  onCreated,
}: {
  triggerLabel?: React.ReactNode;
  triggerProps?: ButtonProps;
  onCreated?: (opts: { name: string; email: string; clinician: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [clinician, setClinician] = React.useState("Dr. Priya Shah — Cardiology");
  const [sentLink, setSentLink] = React.useState<string | null>(null);

  function reset() {
    setName("");
    setEmail("");
    setClinician("Dr. Priya Shah — Cardiology");
    setSentLink(null);
  }

  function close() {
    setOpen(false);
    // Defer the field reset so the dialog's close animation doesn't show
    // the empty state mid-transition.
    setTimeout(reset, 200);
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const href = buildInviteLink({
      role: "patient",
      email: email.trim(),
      clinician: clinician.replace(/—/g, "·"),
      name: name.trim(),
    });
    setSentLink(href);
    onCreated?.({ name: name.trim(), email: email.trim(), clinician });
    toast.success("Patient invitation sent", {
      description: `Email queued to ${email.trim()} · auto-assigned to ${clinician.split("—")[0].trim()}`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button {...triggerProps}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{sentLink ? "Invitation sent" : "Invite a new patient"}</DialogTitle>
          <DialogDescription>
            {sentLink
              ? "Token link emailed. Single-use · expires in 7 days."
              : "Token link is sent via email. The patient sets a password, optionally enrolls MFA, and accepts the active consent policy."}
          </DialogDescription>
        </DialogHeader>

        {sentLink ? (
          <InviteLinkPreview href={sentLink} onClose={close} />
        ) : (
          <form className="space-y-4 pt-2" onSubmit={send}>
            <div className="space-y-1.5">
              <Label htmlFor="pi-name">Full name</Label>
              <Input
                id="pi-name"
                placeholder="Aarav Mehta"
                leadingIcon={<User />}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pi-email">Email</Label>
              <Input
                id="pi-email"
                type="email"
                placeholder="patient@example.com"
                leadingIcon={<Mail />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pi-clinician">Default clinician</Label>
              <select
                id="pi-clinician"
                value={clinician}
                onChange={(e) => setClinician(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
              >
                <option>Dr. Priya Shah — Cardiology</option>
                <option>Dr. Rohan Iyer — General Medicine</option>
                <option>Dr. Neha Kapoor — Dermatology</option>
              </select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit">Send invitation</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
   Reschedule Appointment Dialog
============================================================================ */
interface ReschedulableAppointment {
  id: string;
  doctor: string;
  date: string;
  time: string;
}

export function RescheduleDialog({
  triggerLabel = "Reschedule",
  triggerProps,
  appointment,
  onConfirm,
}: {
  triggerLabel?: React.ReactNode;
  triggerProps?: ButtonProps;
  appointment?: ReschedulableAppointment;
  /** Called with the picked slot label when the user confirms. If omitted,
   *  the dialog falls back to a toast-only stub. */
  onConfirm?: (slot: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [picked, setPicked] = React.useState("Wed, May 27 · 10:30 AM");
  const currentSlot = appointment ? `${appointment.date} · ${appointment.time}` : "Mon, May 25 · 9:30 AM";
  const currentDoctor = appointment?.doctor ?? "Dr. Priya Shah";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...triggerProps}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
          <DialogDescription>
            Within the clinic&apos;s reschedule window. Reminders will be rescheduled for the new slot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-xs">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Current slot</p>
            <p className="mt-1 text-sm font-medium">{currentSlot} · {currentDoctor}</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Available slots — next 3 days
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Wed, May 27 · 10:30 AM",
                "Wed, May 27 · 2:15 PM",
                "Thu, May 28 · 9:00 AM",
                "Thu, May 28 · 11:15 AM",
                "Fri, May 29 · 1:30 PM",
              ].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setPicked(s)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                    picked === s
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                      : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]"
                  }`}
                >
                  <Clock3 className="size-3.5" /> {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={() => setOpen(false)}>Keep current slot</Button>
          <Button
            onClick={() => {
              setOpen(false);
              if (onConfirm) {
                onConfirm(picked);
              } else {
                toast.success("Appointment rescheduled", { description: `New slot: ${picked} · reminders updated` });
              }
            }}
          >
            Move to {picked}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
   Cancel Appointment Dialog
============================================================================ */
interface CancelableAppointment {
  id: string;
  reason: string;
  date: string;
  time: string;
  doctor: string;
}

export function CancelAppointmentDialog({
  triggerLabel = "Cancel",
  triggerProps,
  appointment,
  onConfirm,
}: {
  triggerLabel?: React.ReactNode;
  triggerProps?: ButtonProps;
  appointment?: CancelableAppointment;
  /** Called with the optional reason text when the user confirms. */
  onConfirm?: (reason: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const detail = appointment ?? {
    id: "",
    reason: "Cardiology follow-up",
    date: "Mon, May 25, 2026",
    time: "9:30 AM",
    doctor: "Dr. Priya Shah",
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...triggerProps}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel appointment?</DialogTitle>
          <DialogDescription>
            You are within the clinic&apos;s cancellation window. Both you and your clinician will be notified.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-xs">
          <div className="flex justify-between"><span className="text-[var(--color-muted-foreground)]">Appointment</span><span className="font-medium">{detail.reason}</span></div>
          <div className="flex justify-between"><span className="text-[var(--color-muted-foreground)]">Date</span><span className="font-medium">{detail.date} · {detail.time}</span></div>
          <div className="flex justify-between"><span className="text-[var(--color-muted-foreground)]">Clinician</span><span className="font-medium">{detail.doctor}</span></div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Textarea
            id="cancel-reason"
            placeholder="Scheduling conflict, feeling better, etc."
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Keep appointment</Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false);
              if (onConfirm) {
                onConfirm(reason);
              } else {
                toast.warning("Appointment cancelled", { description: "Reminder jobs cancelled · audit-logged" });
              }
              setReason("");
            }}
          >
            Cancel appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
   Revoke Consent Dialog (Patient)
============================================================================ */
export function RevokeConsentDialog({
  clinician = "Dr. Priya Shah",
  scope = "Lab Reports, Prescriptions, Clinical Notes",
  triggerLabel = "Revoke",
  triggerProps,
  onConfirm,
}: {
  clinician?: string;
  scope?: string;
  triggerLabel?: React.ReactNode;
  triggerProps?: ButtonProps;
  onConfirm?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...triggerProps}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke consent for {clinician}?</DialogTitle>
          <DialogDescription>
            Revocation takes effect <span className="font-medium text-[var(--color-foreground)]">immediately</span> on the next API call.
            {clinician} will lose access to the categories below.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-xs">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Affected scope</p>
          <p className="mt-1 text-sm font-medium">{scope}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Keep consent</Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false);
              if (onConfirm) {
                onConfirm();
              } else {
                toast.warning("Consent revoked", { description: "Effective on next API call · clinician notified" });
              }
            }}
          >
            Revoke access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
   Approve / Reject Consent Request Dialog
============================================================================ */
export function ConsentRequestDialog({
  requester = "Dr. Neha Kapoor",
  scope = "Imaging",
  triggerLabel = "Review",
  triggerProps,
}: {
  requester?: string;
  scope?: string;
  triggerLabel?: React.ReactNode;
  triggerProps?: ButtonProps;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...triggerProps}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Consent request — {requester}</DialogTitle>
          <DialogDescription>
            Read the request and approve or decline. Approval grants under the active policy v2.4.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-xs">
          <div className="flex justify-between"><span className="text-[var(--color-muted-foreground)]">Requested by</span><span className="font-medium inline-flex items-center gap-1"><Stethoscope className="size-3.5" /> {requester}</span></div>
          <div className="flex justify-between"><span className="text-[var(--color-muted-foreground)]">Scope</span><span className="font-medium">{scope}</span></div>
          <div className="flex justify-between"><span className="text-[var(--color-muted-foreground)]">Policy version</span><span className="font-mono font-medium">v2.4</span></div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              toast.info("Consent request declined", { description: `${requester} notified` });
            }}
          >
            Decline
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              toast.success("Consent granted", { description: `${requester} now has ${scope} access` });
            }}
          >
            Approve & sign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
   Break-Glass Confirmation Dialog (Super Admin)
============================================================================ */
export function BreakGlassDialog({ triggerLabel = "Initiate break-glass", triggerProps }: { triggerLabel?: React.ReactNode; triggerProps?: ButtonProps }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...triggerProps}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
            <Flame className="size-5" />
          </div>
          <DialogTitle>Initiate break-glass elevation?</DialogTitle>
          <DialogDescription>
            30-minute window. The tenant&apos;s Compliance Manager and your reporting manager will be notified immediately.
            Every PHI read in this session is tagged <code className="font-mono text-[11px]">break_glass=true</code>.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            toast.error("Break-glass session started · 30:00 timer running", {
              description: "Compliance Manager notified · session ID BG-0015",
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="bg-reason">Justification (required · min 50 chars)</Label>
            <Textarea
              id="bg-reason"
              rows={4}
              placeholder="Describe the incident, who requested elevation, and what data you expect to access…"
              required
              minLength={50}
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
            <input type="checkbox" required className="mt-0.5 size-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30" />
            <span>I acknowledge this is audit-logged with elevated retention and that misuse may constitute a HIPAA violation.</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="destructive">
              <Flame /> Authenticate & elevate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
