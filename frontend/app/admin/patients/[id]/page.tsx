"use client";

import { use, useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  CalendarDays,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Stethoscope,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";

interface Patient {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  profilePhotoUrl: string | null;
  status: "active" | "invited" | "suspended" | "deactivated";
  createdAt: string;
  lastLoginAt: string | null;
  mfaEnrolled: boolean;
  mfaRequired: boolean;
  assigned: boolean;
}

interface AssignedClinician {
  id: string;
  role: string | null;
  notes: string | null;
  startedAt: string;
  clinician: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    designation: string | null;
    department: string | null;
    profilePhotoUrl: string | null;
    status: string;
  };
}

interface AvailableClinician {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string | null;
  department: string | null;
  profilePhotoUrl: string | null;
}

export default function AdminPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<AssignedClinician[]>([]);
  const [available, setAvailable] = useState<AvailableClinician[]>([]);
  const [assignLoading, setAssignLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/patients/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || !data.ok) {
          setError(data.error ?? `HTTP ${r.status}`);
          return;
        }
        setPatient(data.patient);
      })
      .catch(() => {
        if (!cancelled) setError("Network error — could not load patient.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadAssignments = useCallback(async () => {
    setAssignLoading(true);
    try {
      const r = await fetch(`/api/admin/patients/${id}/clinicians`, { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) {
        setAssignments(data.assignments ?? []);
        setAvailable(data.availableClinicians ?? []);
      }
    } catch {
      // surfaced via empty state
    } finally {
      setAssignLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  async function handleRemove(assignmentId: string, clinicianName: string) {
    setRemovingId(assignmentId);
    try {
      const r = await fetch(`/api/admin/patients/${id}/clinicians/${assignmentId}`, {
        method: "DELETE",
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        toast.error(data.error ?? `Could not remove ${clinicianName}.`);
        return;
      }
      toast.success(`${clinicianName} removed from this patient's care team · audit-logged`);
      await loadAssignments();
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="size-4 animate-spin" /> Loading patient…
      </div>
    );
  }
  if (error || !patient) {
    return (
      <div className="space-y-3 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-6">
        <p className="text-sm font-medium text-[var(--color-danger)]">{error ?? "Patient not found."}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/patients">
            <ArrowLeft className="size-3.5" /> Back to patients
          </Link>
        </Button>
      </div>
    );
  }

  const initials = ((patient.firstName[0] ?? "") + (patient.lastName[0] ?? "")).toUpperCase();
  const photo =
    patient.profilePhotoUrl && /^(data:|https?:)/i.test(patient.profilePhotoUrl)
      ? patient.profilePhotoUrl
      : null;

  const assignedIds = new Set(assignments.map((a) => a.clinician.id));
  const unassignedAvailable = available.filter((c) => !assignedIds.has(c.id));

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/admin/patients"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Patients
        </Link>
        <span>/</span>
        <span>{patient.name}</span>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              {photo && <AvatarImage src={photo} alt={patient.name} />}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{patient.name}</h1>
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                {patient.gender ?? "—"}
                {patient.dateOfBirth ? ` · DOB ${patient.dateOfBirth}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={patient.status} />
                {!patient.assigned && <Badge variant="muted" size="sm">Unassigned</Badge>}
                {patient.mfaEnrolled ? (
                  <Badge variant="success" size="sm">
                    <ShieldCheck className="size-3" /> 2FA on
                  </Badge>
                ) : (
                  <Badge variant="muted" size="sm">
                    <ShieldOff className="size-3" /> 2FA off
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Section icon={User} title="A · Personal information">
        <Grid>
          <Field label="First name" value={patient.firstName} />
          <Field label="Last name" value={patient.lastName} />
          <Field
            label="Email"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5 text-[var(--color-muted-foreground)]" /> {patient.email}
              </span>
            }
          />
          <Field
            label="Phone"
            value={
              patient.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5 text-[var(--color-muted-foreground)]" /> {patient.phone}
                </span>
              ) : (
                <em className="text-[var(--color-muted-foreground)]">—</em>
              )
            }
          />
          <Field label="Date of birth" value={patient.dateOfBirth ?? "—"} />
          <Field label="Gender" value={patient.gender ?? "—"} />
        </Grid>
      </Section>

      <Section
        icon={Stethoscope}
        title="B · Assigned clinicians"
        action={
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={unassignedAvailable.length === 0}>
            <UserPlus className="size-3.5" /> Assign clinician
          </Button>
        }
      >
        {assignLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 className="size-3.5 animate-spin" /> Loading care team…
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/40 p-6 text-center text-sm text-[var(--color-muted-foreground)]">
            No clinicians assigned yet.
            {unassignedAvailable.length === 0 && (
              <span className="mt-1 block">
                Add clinicians to this tenant before you can assign one.
              </span>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => {
              const cInitials = (
                (a.clinician.firstName[0] ?? "") + (a.clinician.lastName[0] ?? "")
              ).toUpperCase();
              const cPhoto =
                a.clinician.profilePhotoUrl &&
                /^(data:|https?:)/i.test(a.clinician.profilePhotoUrl)
                  ? a.clinician.profilePhotoUrl
                  : null;
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3"
                >
                  <Avatar className="size-10">
                    {cPhoto && <AvatarImage src={cPhoto} alt={a.clinician.name} />}
                    <AvatarFallback>{cInitials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.clinician.name}</p>
                    <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                      {[a.clinician.designation, a.clinician.department].filter(Boolean).join(" · ") ||
                        a.clinician.email}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted-foreground)]">
                      {a.role && <Badge variant="muted" size="sm">{a.role}</Badge>}
                      <span>Since {new Date(a.startedAt).toLocaleDateString()}</span>
                      {a.notes && <span className="italic">· {a.notes}</span>}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemove(a.id, a.clinician.name)}
                    disabled={removingId === a.id}
                  >
                    {removingId === a.id ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> Removing…
                      </>
                    ) : (
                      <>
                        <X className="size-3.5" /> Remove
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section icon={CalendarDays} title="C · Account">
        <Grid>
          <Field
            label="Enrolled"
            value={new Date(patient.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          <Field
            label="Last sign-in"
            value={
              patient.lastLoginAt
                ? new Date(patient.lastLoginAt).toLocaleString()
                : <em className="text-[var(--color-muted-foreground)]">Never</em>
            }
          />
          <Field label="Status" value={<StatusBadge status={patient.status} />} />
          <Field
            label="Tenant"
            value={patient.assigned ? "Bound to this tenant" : "Self-registered (unassigned)"}
          />
        </Grid>
      </Section>

      <Section icon={ShieldCheck} title="D · Security">
        <Grid>
          <Field
            label="2FA / TOTP"
            value={
              patient.mfaEnrolled ? (
                <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
                  <ShieldCheck className="size-3.5" /> Authenticator app enrolled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[var(--color-muted-foreground)]">
                  <ShieldOff className="size-3.5" /> Not enrolled
                </span>
              )
            }
          />
          <Field
            label="MFA on sign-in"
            value={patient.mfaRequired ? "Required" : "Optional"}
          />
        </Grid>
      </Section>

      <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/patients">
            <ArrowLeft className="size-3.5" /> Back to patients
          </Link>
        </Button>
      </div>

      <AssignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patientId={id}
        patientName={patient.name}
        clinicians={unassignedAvailable}
        onAssigned={loadAssignments}
      />
    </>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  clinicians,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  patientName: string;
  clinicians: AvailableClinician[];
  onAssigned: () => Promise<void> | void;
}) {
  const [clinicianId, setClinicianId] = useState("");
  const [role, setRole] = useState("primary");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setClinicianId("");
      setRole("primary");
      setNotes("");
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clinicianId) {
      toast.error("Pick a clinician to assign.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/admin/patients/${patientId}/clinicians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicianId, role: role || undefined, notes: notes || undefined }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        toast.error(data.error ?? "Could not assign clinician.");
        return;
      }
      toast.success(`${data.assignment.clinician.name} assigned to ${patientName} · audit-logged`);
      onOpenChange(false);
      await onAssigned();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign clinician to {patientName}</DialogTitle>
          <DialogDescription>
            Adds the clinician to this patient&apos;s care team. The change is audit-logged.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="clinician">Clinician</Label>
            <select
              id="clinician"
              required
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              <option value="">Select a clinician…</option>
              {clinicians.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.designation ? ` — ${c.designation}` : ""}
                  {c.department ? ` · ${c.department}` : ""}
                </option>
              ))}
            </select>
            {clinicians.length === 0 && (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                No unassigned clinicians available.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role on the care team</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="flex h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              <option value="primary">Primary</option>
              <option value="specialist">Specialist</option>
              <option value="consulting">Consulting</option>
              <option value="covering">Covering</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Diabetes panel · referred by Dr. X"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !clinicianId}>
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Assigning…
                </>
              ) : (
                "Assign clinician"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4" /> {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: Patient["status"] }) {
  if (status === "deactivated") return <Badge variant="muted" size="sm">Deactivated</Badge>;
  if (status === "suspended")
    return (
      <Badge variant="danger" size="sm" dot>
        Suspended
      </Badge>
    );
  if (status === "invited")
    return (
      <Badge variant="warning" size="sm" dot>
        Invited
      </Badge>
    );
  return (
    <Badge variant="success" size="sm" dot>
      Active
    </Badge>
  );
}
