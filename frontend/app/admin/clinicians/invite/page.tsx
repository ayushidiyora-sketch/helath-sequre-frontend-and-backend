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
  Award,
  Briefcase,
  CalendarClock,
  Users,
  Lock,
  FileText,
  Send,
  ShieldCheck,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const SELECT =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

const DEPARTMENTS = [
  "Cardiology",
  "General Medicine",
  "Pediatrics",
  "Radiology",
  "Dermatology",
  "Orthopedics",
];

const CREATED = [
  "Clinician profile + secure sign-in",
  "Credentials pending license verification",
  "Schedule & slot templates",
  "Panel configuration",
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

function Chips({ name, options }: { name: string; options: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs transition-colors has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-[var(--color-primary-50)] has-[:checked]:text-[var(--color-primary-700)]"
        >
          <input type="checkbox" name={name} value={o} className="size-3.5 accent-[var(--color-primary)]" />
          {o}
        </label>
      ))}
    </div>
  );
}

export default function AddClinicianPage() {
  const router = useRouter();

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/admin/clinicians" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Clinicians
        </Link>
        <span>/</span>
        <span>Add clinician</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Add a clinician</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Create a clinician profile with credentials, schedule, and panel
          configuration. The license is verified before activation.
        </p>
      </div>

      <form
        className="max-w-5xl"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Clinician added", {
            description: "Profile created · pending license verification · audit-logged",
          });
          router.push("/admin/clinicians");
        }}
      >
        <div className="grid gap-5 lg:grid-cols-[1.85fr_1fr]">
          {/* Form sections */}
          <div className="space-y-5">
            {/* A — Personal Information */}
            <Section icon={User} title="A · Personal information">
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

            {/* B — Professional Credentials */}
            <Section icon={Award} title="B · Professional credentials">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Medical license number" htmlFor="medical_license_number">
                  <Input id="medical_license_number" placeholder="e.g., GMC-2014-58213" required />
                </Field>
                <Field label="License expiry date" htmlFor="license_expiry_date">
                  <Input id="license_expiry_date" type="date" required />
                </Field>
                <Field label="License document" htmlFor="license_document" full>
                  <Input id="license_document" type="file" accept=".pdf,.jpg,.jpeg,.png" required />
                </Field>
                <Field label="Registration council" htmlFor="registration_council">
                  <select id="registration_council" className={SELECT} defaultValue="" required>
                    <option value="" disabled>Select council</option>
                    <option>Medical Council of India</option>
                    <option>Gujarat Medical Council</option>
                    <option>Maharashtra Medical Council</option>
                    <option>Delhi Medical Council</option>
                    <option>Karnataka Medical Council</option>
                    <option>Tamil Nadu Medical Council</option>
                  </select>
                </Field>
                <Field label="Qualification" htmlFor="qualification">
                  <Input id="qualification" placeholder="MBBS, MD, MS, DM…" required />
                </Field>
                <Field label="Specialization" htmlFor="specialization">
                  <select id="specialization" className={SELECT} defaultValue="" required>
                    <option value="" disabled>Select specialization</option>
                    <option>Cardiology</option>
                    <option>Pediatrics</option>
                    <option>General Medicine</option>
                    <option>Radiology</option>
                    <option>Dermatology</option>
                    <option>Orthopedics</option>
                    <option>Neurology</option>
                    <option>Gynaecology</option>
                    <option>ENT</option>
                    <option>Psychiatry</option>
                  </select>
                </Field>
                <Field label="Years of experience" htmlFor="years_of_experience">
                  <Input id="years_of_experience" type="number" min={0} placeholder="e.g., 12" required />
                </Field>
                <Field label="Sub-specialization" htmlFor="sub_specialization">
                  <Input id="sub_specialization" placeholder="e.g., Interventional Cardiology" />
                </Field>
              </div>
            </Section>

            {/* C — Department & Assignment */}
            <Section icon={Briefcase} title="C · Department & assignment">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Department" htmlFor="department_id">
                  <select id="department_id" className={SELECT} defaultValue="Cardiology" required>
                    {DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Designation" htmlFor="designation">
                  <Input id="designation" placeholder="e.g., Senior Consultant" required />
                </Field>
                <Field label="Employment type" htmlFor="employment_type">
                  <select id="employment_type" className={SELECT} defaultValue="Full-time" required>
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Visiting</option>
                  </select>
                </Field>
                <Field label="Consultation fee (₹)" htmlFor="consultation_fee">
                  <Input id="consultation_fee" type="number" min={0} placeholder="e.g., 800" />
                </Field>
              </div>
            </Section>

            {/* D — Schedule & Availability */}
            <Section icon={CalendarClock} title="D · Schedule & availability">
              <Field label="Working days" htmlFor="working_days">
                <Chips name="working_days" options={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} />
              </Field>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Working hours — start" htmlFor="working_hours_start">
                  <Input id="working_hours_start" type="time" required />
                </Field>
                <Field label="Working hours — end" htmlFor="working_hours_end">
                  <Input id="working_hours_end" type="time" required />
                </Field>
                <Field label="Slot duration" htmlFor="slot_duration">
                  <select id="slot_duration" className={SELECT} defaultValue="30 min" required>
                    <option>15 min</option>
                    <option>30 min</option>
                    <option>45 min</option>
                    <option>60 min</option>
                  </select>
                </Field>
                <Field label="Max patients per day" htmlFor="max_patients_per_day">
                  <Input id="max_patients_per_day" type="number" min={0} placeholder="e.g., 24" />
                </Field>
                <Field label="Break time" htmlFor="break_start" full>
                  <div className="flex items-center gap-2">
                    <Input id="break_start" type="time" />
                    <span className="text-xs text-[var(--color-muted-foreground)]">to</span>
                    <Input id="break_end" type="time" />
                  </div>
                </Field>
              </div>
            </Section>

            {/* E — Panel Configuration */}
            <Section icon={Users} title="E · Panel configuration">
              <Field label="Appointment types" htmlFor="appointment_types">
                <Chips name="appointment_types" options={["In-person", "Follow-up", "Emergency"]} />
              </Field>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Panel size (max patients assigned)" htmlFor="panel_size">
                  <Input id="panel_size" type="number" min={0} placeholder="e.g., 150" />
                </Field>
              </div>
              <div className="mt-4">
                <ToggleRow
                  label="Accepting new patients"
                  desc="New patients can be assigned to this clinician's panel."
                  defaultChecked
                />
              </div>
            </Section>

            {/* F — Security & Access */}
            <Section icon={Lock} title="F · Security & access">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password" htmlFor="password">
                  <Input id="password" type="password" placeholder="••••••••••••" autoComplete="new-password" required />
                </Field>
                <Field label="Confirm password" htmlFor="confirm_password">
                  <Input id="confirm_password" type="password" placeholder="••••••••••••" autoComplete="new-password" required />
                </Field>
                <Field label="Account status" htmlFor="account_status">
                  <select id="account_status" className={`${SELECT} bg-[var(--color-muted)]`} defaultValue="Pending verification" disabled>
                    <option>Pending verification</option>
                  </select>
                </Field>
              </div>
              <div className="mt-4">
                <ToggleRow
                  label="Require MFA"
                  desc="Mandatory for all clinical roles — cannot be disabled."
                  defaultChecked
                  disabled
                />
              </div>
            </Section>

            {/* G — Additional Info */}
            <Section icon={FileText} title="G · Additional info">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bio" htmlFor="bio" full>
                  <Textarea id="bio" rows={3} placeholder="Short professional summary shown to patients." />
                </Field>
                <Field label="Languages spoken" htmlFor="languages_spoken" full>
                  <Chips
                    name="languages_spoken"
                    options={["English", "Hindi", "Gujarati", "Marathi", "Tamil", "Telugu", "Bengali"]}
                  />
                </Field>
                <Field label="Awards & recognition" htmlFor="awards_recognition" full>
                  <Textarea id="awards_recognition" rows={2} placeholder="Notable awards, fellowships, or publications." />
                </Field>
              </div>
            </Section>
            {/* Footer — mirrors the sticky-sidebar actions for users who scroll past it */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                <ShieldCheck className="size-3.5" /> License is verified before activation
              </span>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/admin/clinicians">Cancel</Link>
                </Button>
                <Button type="submit">
                  <Send /> Add clinician
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
                Complete all sections, then create the clinician profile.
              </p>
              <Button type="submit" className="mt-4 w-full">
                <Send /> Add clinician
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link href="/admin/clinicians">Cancel</Link>
              </Button>
              <span className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                <ShieldCheck className="size-3.5" /> License is verified before activation
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
