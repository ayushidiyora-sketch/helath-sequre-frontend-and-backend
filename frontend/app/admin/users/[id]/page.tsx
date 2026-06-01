"use client";

import { useEffect, useState, use, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  User,
  BadgeCheck,
  Briefcase,
  Lock,
  KeyRound,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Staff {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  status: "active" | "invited" | "suspended" | "deactivated";
  employeeId: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  profilePhotoUrl: string | null;
  department: string | null;
  designation: string | null;
  accessLevel: string | null;
  reportingTo: string | null;
  joiningDate: string | null;
  employmentType: string | null;
  shift: string | null;
  workLocation: string | null;
  permissions: Record<string, boolean>;
  mfaRequired: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || !data.ok) {
          setError(data.error ?? `HTTP ${r.status}`);
          return;
        }
        setStaff(data.staff);
      })
      .catch(() => {
        if (!cancelled) setError("Network error — could not load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="size-4 animate-spin" /> Loading profile…
      </div>
    );
  }
  if (error || !staff) {
    return (
      <div className="space-y-3 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-6">
        <p className="text-sm font-medium text-[var(--color-danger)]">
          {error ?? "Profile not found."}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="size-3.5" /> Back to staff
          </Link>
        </Button>
      </div>
    );
  }

  const initials = ((staff.firstName[0] ?? "") + (staff.lastName[0] ?? "")).toUpperCase();
  const fullName = `Dr. ${staff.firstName} ${staff.lastName}`.trim();

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Staff
        </Link>
        <span>/</span>
        <span>{fullName}</span>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              {staff.profilePhotoUrl && /^(data:|https?:)/i.test(staff.profilePhotoUrl) && (
                <AvatarImage src={staff.profilePhotoUrl} alt={`${staff.firstName} ${staff.lastName}`} />
              )}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                {staff.designation || staff.role}
                {staff.department ? ` · ${staff.department}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={staff.status} />
                <Badge variant="muted" size="sm">{staff.role}</Badge>
                {staff.mfaRequired && (
                  <Badge variant="info" size="sm">
                    <ShieldCheck className="size-3" /> MFA required
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href={`/admin/users/${staff.slug}/edit`}>
              <Pencil /> Edit profile
            </Link>
          </Button>
        </div>
      </div>

      <Section icon={User} title="A · Basic information">
        <Grid>
          <Field label="First name" value={staff.firstName} />
          <Field label="Last name" value={staff.lastName} />
          <Field
            label="Email"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5 text-[var(--color-muted-foreground)]" /> {staff.email}
              </span>
            }
          />
          <Field
            label="Phone"
            value={
              staff.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5 text-[var(--color-muted-foreground)]" /> {staff.phone}
                </span>
              ) : (
                <em className="text-[var(--color-muted-foreground)]">—</em>
              )
            }
          />
          <Field label="Employee ID" value={staff.employeeId ?? "—"} />
          <Field label="Date of birth" value={staff.dateOfBirth ?? "—"} />
          <Field label="Gender" value={staff.gender ?? "—"} />
          <Field
            label="Profile photo"
            value={
              staff.profilePhotoUrl ? (
                /^(data:|https?:)/i.test(staff.profilePhotoUrl) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={staff.profilePhotoUrl}
                    alt={`${staff.firstName} ${staff.lastName}`}
                    className="size-24 rounded-lg border border-[var(--color-border)] object-cover"
                  />
                ) : (
                  <span className="text-sm">{staff.profilePhotoUrl}</span>
                )
              ) : (
                <em className="text-[var(--color-muted-foreground)]">Not uploaded</em>
              )
            }
          />
        </Grid>
      </Section>

      <Section icon={BadgeCheck} title="B · Role & access">
        <Grid>
          <Field label="Role" value={staff.role} />
          <Field label="Department" value={staff.department ?? "—"} />
          <Field label="Designation" value={staff.designation ?? "—"} />
          <Field label="Access level" value={staff.accessLevel ?? "—"} />
          <Field label="Reporting to" value={staff.reportingTo ?? "—"} full />
        </Grid>
      </Section>

      <Section icon={Briefcase} title="C · Employment details">
        <Grid>
          <Field label="Joining date" value={staff.joiningDate ?? "—"} />
          <Field label="Employment type" value={staff.employmentType ?? "—"} />
          <Field label="Shift" value={staff.shift ?? "—"} />
          <Field label="Work location" value={staff.workLocation ?? "—"} />
        </Grid>
      </Section>

      <Section icon={Lock} title="D · Security">
        <Grid>
          <Field
            label="Account status"
            value={
              <StatusBadge status={staff.status} />
            }
          />
          <Field
            label="MFA"
            value={
              staff.mfaRequired ? (
                <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
                  <ShieldCheck className="size-3.5" /> Required
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[var(--color-muted-foreground)]">
                  <KeyRound className="size-3.5" /> Optional
                </span>
              )
            }
          />
          <Field label="Last sign-in" value={formatDateTime(staff.lastLoginAt)} />
          <Field label="Created" value={formatDateTime(staff.createdAt)} />
        </Grid>
      </Section>

      <Section icon={KeyRound} title="E · Permissions">
        <div className="grid gap-3 sm:grid-cols-2">
          <PermissionRow label="Can view patients" on={!!staff.permissions.canViewPatients} />
          <PermissionRow label="Can manage appointments" on={!!staff.permissions.canManageAppointments} />
          <PermissionRow label="Can access records" on={!!staff.permissions.canAccessRecords} />
          <PermissionRow label="Can send messages" on={!!staff.permissions.canSendMessages} />
        </div>
      </Section>

      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] pt-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="size-3.5" /> Back to staff
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href={`/admin/users/${staff.slug}/edit`}>
            <Pencil /> Edit profile
          </Link>
        </Button>
      </div>
    </>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4" /> {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>;
}

function Field({ label, value, full }: { label: string; value: ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function PermissionRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-sm">
      <span>{label}</span>
      {on ? (
        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-success)]">
          <CheckCircle2 className="size-3.5" /> Allowed
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-muted-foreground)]">
          <XCircle className="size-3.5" /> Denied
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Staff["status"] }) {
  if (status === "deactivated") return <Badge variant="muted" size="sm">Deactivated</Badge>;
  if (status === "suspended") return <Badge variant="danger" size="sm" dot>Suspended</Badge>;
  if (status === "invited") return <Badge variant="warning" size="sm" dot>Invited</Badge>;
  return <Badge variant="success" size="sm" dot>Active</Badge>;
}

function formatDateTime(iso: string | null): ReactNode {
  if (!iso) return <em className="text-[var(--color-muted-foreground)]">Never</em>;
  return new Date(iso).toLocaleString();
}
