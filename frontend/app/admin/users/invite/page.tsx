"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  Send,
  ShieldCheck,
  CheckCircle2,
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

const CREATED = [
  "Staff account with secure sign-in",
  "Role & department assignment",
  "Role-based permission set",
  "MFA enrolled at first sign-in",
  "Single-use onboarding link in welcome email",
];

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
  disabled,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-[11px] text-[var(--color-muted-foreground)]">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export default function AddStaffPage() {
  const router = useRouter();

  // A — Basic information
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  // Profile photo persisted as a base64 data URL so the view page can preview it.
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState("");
  const [profilePhotoFilename, setProfilePhotoFilename] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Auto-fill the next sequential Employee ID (EMP-001) by checking what
  // already exists in this tenant. Caller can still edit before submit.
  useEffect(() => {
    let cancelled = false;
    // Fetch existing staff (for next Employee ID) + departments in parallel.
    Promise.all([
      fetch("/api/admin/users").then((r) => (r.ok ? r.json() : { staff: [] })),
      fetch("/api/admin/departments").then((r) => (r.ok ? r.json() : { departments: [] })),
    ])
      .then(
        ([staffData, deptData]: [
          { staff?: { employeeId?: string | null }[] },
          { departments?: { name: string }[] },
        ]) => {
          if (cancelled) return;
          // Next sequential Employee ID
          let max = 0;
          for (const s of staffData.staff ?? []) {
            const m = /^EMP-(\d+)$/.exec(s.employeeId ?? "");
            if (m) {
              const n = Number(m[1]);
              if (n > max) max = n;
            }
          }
          setEmployeeId(`EMP-${(max + 1).toString().padStart(3, "0")}`);

          // Dynamic department list from this tenant's Postgres rows
          const names = (deptData.departments ?? []).map((d) => d.name);
          setDepartments(names);
          if (names.length > 0) setDepartment(names[0]);
        },
      )
      .catch(() => {
        setEmployeeId("EMP-001");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePhotoChange(file: File | undefined) {
    setPhotoError(null);
    if (!file) {
      setProfilePhotoDataUrl("");
      setProfilePhotoFilename("");
      return;
    }
    if (file.size > 500_000) {
      setPhotoError("Photo too large. Max 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfilePhotoDataUrl(typeof reader.result === "string" ? reader.result : "");
      setProfilePhotoFilename(file.name);
    };
    reader.readAsDataURL(file);
  }

  // B — Role & access
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("Clinician");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [designation, setDesignation] = useState("");
  const [accessLevel, setAccessLevel] = useState("Standard");
  const [reportingTo, setReportingTo] = useState("");

  // C — Employment details
  const [joiningDate, setJoiningDate] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [shift, setShift] = useState("");
  const [workLocation, setWorkLocation] = useState("");

  // D — Security
  const [mfaRequired, setMfaRequired] = useState(true);

  // E — Permissions
  const [canViewPatients, setCanViewPatients] = useState(true);
  const [canManageAppointments, setCanManageAppointments] = useState(true);
  const [canAccessRecords, setCanAccessRecords] = useState(false);
  const [canSendMessages, setCanSendMessages] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          role,
          employeeId: employeeId.trim() || undefined,
          dateOfBirth: dateOfBirth || undefined,
          gender: gender || undefined,
          profilePhotoUrl: profilePhotoDataUrl || undefined,
          department: department || undefined,
          designation: designation.trim() || undefined,
          accessLevel,
          reportingTo: reportingTo || undefined,
          joiningDate: joiningDate || undefined,
          employmentType,
          shift: shift || undefined,
          workLocation: workLocation.trim() || undefined,
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
        setError(data.error ?? "Could not add staff member.");
        setSubmitting(false);
        return;
      }
      if (data.mailSent) {
        toast.success(`${firstName} ${lastName} added`, {
          description: `Welcome email sent via ${data.mailVia} to ${email.trim()} · audit-logged`,
        });
      } else {
        const pw = data.devCredentials?.password as string | undefined;
        toast.warning(`${firstName} ${lastName} added — email NOT delivered`, {
          description: `${data.mailError ?? "Mail transport failed"}${
            pw ? `\n\nTemp password (share out-of-band): ${pw}` : ""
          }`,
          duration: 20000,
        });
      }
      router.push("/admin/users");
    } catch {
      setError("Network error — could not reach the server.");
      setSubmitting(false);
    }
  }

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
        <span>Add staff member</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Add a staff member</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Create a staff account with role, employment, and access details. Every field is persisted
          to Postgres. The member enrolls MFA before first sign-in.
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
                    placeholder="Aisha"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Last name" htmlFor="last_name">
                  <Input
                    id="last_name"
                    placeholder="Khan"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Email" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    leadingIcon={<Mail />}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Phone" htmlFor="phone">
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    leadingIcon={<Phone />}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <Field
                  label="Employee ID"
                  htmlFor="employee_id"
                  hint="Auto-generated as the next sequential EMP-XXX. Locked."
                >
                  <Input
                    id="employee_id"
                    placeholder="EMP-001"
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
                  hint={photoError ?? (profilePhotoFilename ? `Loaded: ${profilePhotoFilename}` : "Max 500 KB · stored inline as a data URL")}
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
                    required
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Department"
                  htmlFor="department"
                  hint={
                    departments.length === 0
                      ? "No departments defined yet. Create one at /admin/departments/new."
                      : undefined
                  }
                >
                  <select
                    id="department"
                    className={SELECT}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={departments.length === 0}
                  >
                    <option value="">— None —</option>
                    {departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Designation" htmlFor="designation">
                  <Input
                    id="designation"
                    placeholder="e.g., Senior Staff Nurse"
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
                    placeholder="Supervisor name"
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
                    placeholder="e.g., Main campus · Block B"
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                  />
                </Field>
              </div>
            </Section>

            <Section icon={Lock} title="D · Security">
              <p className="text-xs text-[var(--color-muted-foreground)]">
                A strong temporary password is auto-generated, bcrypt-hashed (cost 12), and emailed
                to the invitee with a single-use onboarding link. They&apos;ll be required to set a
                new password on first sign-in.
              </p>
              <div className="mt-4">
                <ToggleRow
                  label="Require MFA"
                  desc="Time-based OTP enrolled at first sign-in."
                  checked={mfaRequired}
                  onCheckedChange={setMfaRequired}
                />
              </div>
            </Section>

            <Section icon={KeyRound} title="E · Permissions">
              <p className="-mt-1 mb-3 text-[11px] text-[var(--color-muted-foreground)]">
                Defaults follow the selected role — adjust per individual where needed.
              </p>
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
                <ShieldCheck className="size-3.5" /> Staff creation is audit-logged
              </span>
              <div className="flex gap-2">
                <Button asChild variant="outline" type="button" disabled={submitting}>
                  <Link href="/admin/users">Cancel</Link>
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" /> Sending invite…
                    </>
                  ) : (
                    <>
                      <Send /> Add staff member
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Ready to add
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Review all five sections, then create the account.
              </p>
              <Button type="submit" className="mt-4 w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send /> Add staff member
                  </>
                )}
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full" type="button">
                <Link href="/admin/users">Cancel</Link>
              </Button>
              <span className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                <ShieldCheck className="size-3.5" /> Staff creation is audit-logged
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                What gets created
              </p>
              <ul className="mt-3 space-y-2 text-xs text-[var(--color-muted-foreground)]">
                {CREATED.map((c) => (
                  <li key={c} className="flex gap-2">
                    <CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" /> {c}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}
