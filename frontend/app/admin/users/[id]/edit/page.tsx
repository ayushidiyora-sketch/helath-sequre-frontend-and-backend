"use client";

import { useEffect, useState, use, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
  BadgeCheck,
  Briefcase,
  Lock,
  KeyRound,
  Save,
  ShieldCheck,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const SELECT =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

const ROLE_OPTIONS = ["Clinician", "Compliance Manager", "Auditor"] as const;
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
const ACCESS_LEVELS = ["Standard", "Elevated", "Restricted"];
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract"];
const SHIFTS = ["Morning", "Evening", "Night", "Rotating"];
const STATUSES = ["active", "invited", "suspended", "deactivated"] as const;

interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  status: (typeof STATUSES)[number];
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
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4" /> {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  full,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  full?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-[var(--color-muted-foreground)]">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onCheckedChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-[11px] text-[var(--color-muted-foreground)]">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirror every field from Staff into local state.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("Clinician");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("active");
  const [employeeId, setEmployeeId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [profilePhotoFilename, setProfilePhotoFilename] = useState("");
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handlePhotoChange(file: File | undefined) {
    setPhotoError(null);
    if (!file) return;
    if (file.size > 500_000) {
      setPhotoError("Photo too large. Max 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      setProfilePhotoDataUrl(url);
      setProfilePhotoFilename(file.name);
    };
    reader.readAsDataURL(file);
  }
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [designation, setDesignation] = useState("");
  const [accessLevel, setAccessLevel] = useState("Standard");
  const [reportingTo, setReportingTo] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [shift, setShift] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [mfaRequired, setMfaRequired] = useState(true);
  const [canViewPatients, setCanViewPatients] = useState(true);
  const [canManageAppointments, setCanManageAppointments] = useState(true);
  const [canAccessRecords, setCanAccessRecords] = useState(false);
  const [canSendMessages, setCanSendMessages] = useState(true);

  // Departments are tenant-scoped and only the org admin can list them — fetch
  // once on mount so the dropdown always reflects the current set.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/departments")
      .then((r) => (r.ok ? r.json() : { departments: [] }))
      .then((data: { departments?: { name: string }[] }) => {
        if (!cancelled) setDepartments((data.departments ?? []).map((d) => d.name));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || !data.ok) {
          setLoadError(data.error ?? `HTTP ${r.status}`);
          return;
        }
        const s: Staff = data.staff;
        setFirstName(s.firstName);
        setLastName(s.lastName);
        setEmail(s.email);
        setPhone(s.phone ?? "");
        const matchedRole = (ROLE_OPTIONS as readonly string[]).includes(s.role)
          ? (s.role as (typeof ROLE_OPTIONS)[number])
          : "Clinician";
        setRole(matchedRole);
        setStatus(s.status);
        setEmployeeId(s.employeeId ?? "");
        setDateOfBirth(s.dateOfBirth ?? "");
        setGender(s.gender ?? "");
        // The stored value may be a data URL OR just a filename — show it.
        const stored = s.profilePhotoUrl ?? "";
        if (stored.startsWith("data:")) {
          setProfilePhotoDataUrl(stored);
          setProfilePhotoFilename("Current photo");
        } else {
          setProfilePhotoDataUrl("");
          setProfilePhotoFilename(stored);
        }
        setDepartment(s.department ?? "");
        setDesignation(s.designation ?? "");
        setAccessLevel(s.accessLevel ?? "Standard");
        setReportingTo(s.reportingTo ?? "");
        setJoiningDate(s.joiningDate ?? "");
        setEmploymentType(s.employmentType ?? "Full-time");
        setShift(s.shift ?? "");
        setWorkLocation(s.workLocation ?? "");
        setMfaRequired(s.mfaRequired);
        setCanViewPatients(!!s.permissions.canViewPatients);
        setCanManageAppointments(!!s.permissions.canManageAppointments);
        setCanAccessRecords(!!s.permissions.canAccessRecords);
        setCanSendMessages(!!s.permissions.canSendMessages);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Network error — could not load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
          role,
          status,
          employeeId: employeeId.trim() || null,
          dateOfBirth: dateOfBirth || null,
          gender: gender || null,
          // Send the new data URL when one was selected; otherwise keep the
          // existing stored value (data URL or legacy filename).
          profilePhotoUrl: profilePhotoDataUrl || profilePhotoFilename || null,
          department: department || null,
          designation: designation.trim() || null,
          accessLevel,
          reportingTo: reportingTo.trim() || null,
          joiningDate: joiningDate || null,
          employmentType,
          shift: shift || null,
          workLocation: workLocation.trim() || null,
          permissions: {
            canViewPatients,
            canManageAppointments,
            canAccessRecords,
            canSendMessages,
          },
          mfaRequired,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not save changes.");
        setSubmitting(false);
        return;
      }
      toast.success(`${firstName} ${lastName} updated`, {
        description: "Profile saved · audit-logged",
      });
      router.push(`/admin/users/${encodeURIComponent(id)}`);
    } catch {
      setError("Network error — could not reach the server.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="size-4 animate-spin" /> Loading profile…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="space-y-3 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-6">
        <p className="text-sm font-medium text-[var(--color-danger)]">{loadError}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="size-3.5" /> Back to staff
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href={`/admin/users/${encodeURIComponent(id)}`}
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Profile
        </Link>
        <span>/</span>
        <span>Edit</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Edit Dr. {firstName} {lastName}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Update profile, role, employment, permissions, and account status. Email cannot be
          changed once the account exists.
        </p>
      </div>

      <form className="max-w-5xl" onSubmit={handleSubmit}>
        <div className="grid gap-5 lg:grid-cols-[1.85fr_1fr]">
          <div className="space-y-5">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
              >
                {error}
              </div>
            )}

            <Section icon={User} title="A · Basic information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="first_name">
                  <Input
                    id="first_name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Last name" htmlFor="last_name">
                  <Input
                    id="last_name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Email" htmlFor="email" hint="Email is immutable once the account exists.">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    readOnly
                    disabled
                    leadingIcon={<Mail />}
                  />
                </Field>
                <Field label="Phone" htmlFor="phone">
                  <Input
                    id="phone"
                    type="tel"
                    leadingIcon={<Phone />}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <Field
                  label="Employee ID"
                  htmlFor="employee_id"
                  hint="Immutable once assigned."
                >
                  <Input
                    id="employee_id"
                    value={employeeId}
                    readOnly
                    disabled
                    className="bg-[var(--color-muted)]"
                  />
                </Field>
                <Field label="Date of birth" htmlFor="date_of_birth">
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </Field>
                <Field label="Gender" htmlFor="gender">
                  <select
                    id="gender"
                    className={SELECT}
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="">Select gender</option>
                    {GENDERS.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Profile photo"
                  htmlFor="profile_photo"
                  hint={photoError ?? (profilePhotoFilename ? `Current: ${profilePhotoFilename}` : "Max 500 KB")}
                >
                  <Input
                    id="profile_photo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                  />
                  {profilePhotoDataUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={profilePhotoDataUrl}
                      alt="preview"
                      className="mt-2 size-20 rounded-lg border border-[var(--color-border)] object-cover"
                    />
                  )}
                </Field>
              </div>
            </Section>

            <Section icon={BadgeCheck} title="B · Role & access">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Role" htmlFor="role">
                  <select
                    id="role"
                    className={SELECT}
                    value={role}
                    onChange={(e) => setRole(e.target.value as (typeof ROLE_OPTIONS)[number])}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Department" htmlFor="department">
                  <select
                    id="department"
                    className={SELECT}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {/* Preserve the user's currently-assigned department even
                        if it's no longer in the dynamic list (e.g. the dept
                        was renamed). */}
                    {department && !departments.includes(department) && (
                      <option value={department}>{department} (legacy)</option>
                    )}
                    {departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Designation" htmlFor="designation">
                  <Input
                    id="designation"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                  />
                </Field>
                <Field label="Access level" htmlFor="access_level">
                  <select
                    id="access_level"
                    className={SELECT}
                    value={accessLevel}
                    onChange={(e) => setAccessLevel(e.target.value)}
                  >
                    {ACCESS_LEVELS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Reporting to" htmlFor="reporting_to" full>
                  <Input
                    id="reporting_to"
                    value={reportingTo}
                    onChange={(e) => setReportingTo(e.target.value)}
                  />
                </Field>
              </div>
            </Section>

            <Section icon={Briefcase} title="C · Employment details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Joining date" htmlFor="joining_date">
                  <Input
                    id="joining_date"
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                  />
                </Field>
                <Field label="Employment type" htmlFor="employment_type">
                  <select
                    id="employment_type"
                    className={SELECT}
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                  >
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Shift" htmlFor="shift">
                  <select
                    id="shift"
                    className={SELECT}
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                  >
                    <option value="">Select shift</option>
                    {SHIFTS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Work location" htmlFor="work_location">
                  <Input
                    id="work_location"
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                  />
                </Field>
              </div>
            </Section>

            <Section icon={Lock} title="D · Security">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account status" htmlFor="status">
                  <select
                    id="status"
                    className={SELECT}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="MFA required">
                  <div className="flex h-10 items-center justify-between rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm">
                    <span>Enforce on sign-in</span>
                    <Switch checked={mfaRequired} onCheckedChange={setMfaRequired} />
                  </div>
                </Field>
              </div>
            </Section>

            <Section icon={KeyRound} title="E · Permissions">
              <div className="space-y-2">
                <ToggleRow
                  label="Can view patients"
                  desc="See the patient roster and operational metadata."
                  checked={canViewPatients}
                  onCheckedChange={setCanViewPatients}
                />
                <ToggleRow
                  label="Can manage appointments"
                  desc="Book, reschedule, and cancel appointments."
                  checked={canManageAppointments}
                  onCheckedChange={setCanManageAppointments}
                />
                <ToggleRow
                  label="Can access records"
                  desc="Open consent-bound medical records."
                  checked={canAccessRecords}
                  onCheckedChange={setCanAccessRecords}
                />
                <ToggleRow
                  label="Can send messages"
                  desc="Use secure messaging with patients and staff."
                  checked={canSendMessages}
                  onCheckedChange={setCanSendMessages}
                />
              </div>
            </Section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                <ShieldCheck className="size-3.5" /> Edits are audit-logged
              </span>
              <div className="flex gap-2">
                <Button asChild variant="outline" type="button" disabled={submitting}>
                  <Link href={`/admin/users/${encodeURIComponent(id)}`}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save /> Save changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Save changes
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                All sections submit together. Status changes are applied immediately.
              </p>
              <Button type="submit" className="mt-4 w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save /> Save changes
                  </>
                )}
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full" type="button">
                <Link href={`/admin/users/${encodeURIComponent(id)}`}>Cancel</Link>
              </Button>
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}
