"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ReactNode } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const SELECT =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

const DEPARTMENTS = [
  "Cardiology",
  "General Medicine",
  "Pediatrics",
  "Radiology",
  "Dermatology",
  "Operations",
  "Compliance",
];

const CREATED = [
  "Staff account with secure sign-in",
  "Role & department assignment",
  "Role-based permission set",
  "MFA enrolled at first sign-in",
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
  defaultChecked,
  disabled,
}: {
  label: string;
  desc?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-[11px] text-[var(--color-muted-foreground)]">{desc}</p>}
      </div>
      <Switch defaultChecked={defaultChecked} disabled={disabled} />
    </div>
  );
}

export default function AddStaffPage() {
  const router = useRouter();

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/admin/users" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Staff
        </Link>
        <span>/</span>
        <span>Add staff member</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Add a staff member</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Create a staff account with role, employment, and access details. The
          member enrolls MFA before first sign-in.
        </p>
      </div>

      <form
        className="max-w-5xl"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Staff member added", {
            description: "Account created · welcome email dispatched · audit-logged",
          });
          router.push("/admin/users");
        }}
      >
        <div className="grid gap-5 lg:grid-cols-[1.85fr_1fr]">
          {/* Form sections */}
          <div className="space-y-5">
            {/* A — Basic Information */}
            <Section icon={User} title="A · Basic information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="first_name">
                  <Input id="first_name" placeholder="Aisha" required />
                </Field>
                <Field label="Last name" htmlFor="last_name">
                  <Input id="last_name" placeholder="Khan" required />
                </Field>
                <Field label="Email" htmlFor="email">
                  <Input id="email" type="email" placeholder="name@citygeneral.health" leadingIcon={<Mail />} required />
                </Field>
                <Field label="Phone" htmlFor="phone">
                  <Input id="phone" type="tel" placeholder="+91 98765 43210" leadingIcon={<Phone />} required />
                </Field>
                <Field label="Employee ID" htmlFor="employee_id">
                  <Input id="employee_id" placeholder="EMP-00481" required />
                </Field>
                <Field label="Date of birth" htmlFor="date_of_birth">
                  <Input id="date_of_birth" type="date" />
                </Field>
                <Field label="Gender" htmlFor="gender">
                  <select id="gender" className={SELECT} defaultValue="">
                    <option value="" disabled>Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                    <option>Prefer not to say</option>
                  </select>
                </Field>
                <Field label="Profile photo" htmlFor="profile_photo">
                  <Input id="profile_photo" type="file" accept="image/*" />
                </Field>
              </div>
            </Section>

            {/* B — Role & Access */}
            <Section icon={BadgeCheck} title="B · Role & access">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Role" htmlFor="role">
                  <select id="role" className={SELECT} defaultValue="Nurse" required>
                    <option>Nurse</option>
                    <option>Receptionist</option>
                    <option>Lab Technician</option>
                    <option>Pharmacist</option>
                    <option>Admin Staff</option>
                    <option>Support</option>
                  </select>
                </Field>
                <Field label="Department" htmlFor="department_id">
                  <select id="department_id" className={SELECT} defaultValue="General Medicine" required>
                    {DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Designation" htmlFor="designation">
                  <Input id="designation" placeholder="e.g., Senior Staff Nurse" required />
                </Field>
                <Field label="Access level" htmlFor="access_level">
                  <select id="access_level" className={SELECT} defaultValue="Standard" required>
                    <option>Standard</option>
                    <option>Elevated</option>
                    <option>Restricted</option>
                  </select>
                </Field>
                <Field label="Reporting to" htmlFor="reporting_to" full>
                  <select id="reporting_to" className={SELECT} defaultValue="">
                    <option value="">— Not assigned —</option>
                    <option>Maya Iyer · Org Admin</option>
                    <option>Dr. Priya Shah · Cardiology Lead</option>
                    <option>Dr. Rohan Iyer · General Medicine Lead</option>
                  </select>
                </Field>
              </div>
            </Section>

            {/* C — Employment Details */}
            <Section icon={Briefcase} title="C · Employment details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Joining date" htmlFor="joining_date">
                  <Input id="joining_date" type="date" required />
                </Field>
                <Field label="Employment type" htmlFor="employment_type">
                  <select id="employment_type" className={SELECT} defaultValue="Full-time" required>
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                  </select>
                </Field>
                <Field label="Shift" htmlFor="shift">
                  <select id="shift" className={SELECT} defaultValue="">
                    <option value="">Select shift</option>
                    <option>Morning</option>
                    <option>Evening</option>
                    <option>Night</option>
                    <option>Rotating</option>
                  </select>
                </Field>
                <Field label="Work location" htmlFor="work_location">
                  <Input id="work_location" placeholder="e.g., Main campus · Block B" />
                </Field>
              </div>
            </Section>

            {/* D — Security */}
            <Section icon={Lock} title="D · Security">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password" htmlFor="password">
                  <Input id="password" type="password" placeholder="••••••••••••" autoComplete="new-password" required />
                </Field>
                <Field label="Confirm password" htmlFor="confirm_password">
                  <Input id="confirm_password" type="password" placeholder="••••••••••••" autoComplete="new-password" required />
                </Field>
                <Field label="Account status" htmlFor="account_status">
                  <select id="account_status" className={`${SELECT} bg-[var(--color-muted)]`} defaultValue="Active" disabled>
                    <option>Active</option>
                  </select>
                </Field>
              </div>
              <div className="mt-4">
                <ToggleRow label="Require MFA" desc="Time-based OTP enrolled at first sign-in." defaultChecked />
              </div>
            </Section>

            {/* E — Permissions */}
            <Section icon={KeyRound} title="E · Permissions">
              <p className="-mt-1 mb-3 text-[11px] text-[var(--color-muted-foreground)]">
                Defaults follow the selected role — adjust per individual where needed.
              </p>
              <div className="space-y-2">
                <ToggleRow label="Can view patients" desc="See the patient roster and operational metadata." defaultChecked />
                <ToggleRow label="Can manage appointments" desc="Book, reschedule, and cancel appointments." defaultChecked />
                <ToggleRow label="Can access records" desc="Open consent-bound medical records." />
                <ToggleRow label="Can send messages" desc="Use secure messaging with patients and staff." defaultChecked />
              </div>
            </Section>
            {/* Footer — mirrors the sticky-sidebar actions for users who scroll past it */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                <ShieldCheck className="size-3.5" /> Staff creation is audit-logged
              </span>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/admin/users">Cancel</Link>
                </Button>
                <Button type="submit">
                  <Send /> Add staff member
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Ready to add
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Review all five sections, then create the account.
              </p>
              <Button type="submit" className="mt-4 w-full">
                <Send /> Add staff member
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
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
