"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Mail,
  Phone,
  UserPlus2,
  MapPin,
  Fingerprint,
  HeartPulse,
  ShieldCheck,
  Lock,
  Send,
  CheckCircle2,
  Stethoscope,
  Hash,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

const SELECT =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

const STATES = [
  "Gujarat",
  "Maharashtra",
  "Delhi",
  "Karnataka",
  "Tamil Nadu",
  "Rajasthan",
  "West Bengal",
  "Uttar Pradesh",
  "Telangana",
  "Kerala",
];

const DEPARTMENTS = [
  "Cardiology",
  "General Medicine",
  "Pediatrics",
  "Radiology",
  "Dermatology",
  "Orthopedics",
];

const CLINICIANS = [
  "Dr. Priya Shah · Cardiology",
  "Dr. Rohan Iyer · General Medicine",
  "Dr. Neha Kapoor · Dermatology",
  "Dr. Aisha Khan · Pediatrics",
];

const CREATED = [
  "Patient record + auto-assigned MRN",
  "Demographics, contact & medical history",
  "Clinician & department assignment",
  "Consent records captured",
  "Enrollment email to the patient",
];

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4" /> {title}
      </h2>
      {hint && <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  full,
  hint,
  locked,
  recommended,
  children,
}: {
  label: string;
  htmlFor?: string;
  full?: boolean;
  hint?: string;
  locked?: boolean;
  recommended?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
        {label}
        {locked && <Lock className="size-3 text-[var(--color-muted-foreground)]" />}
        {recommended && (
          <span className="text-[10px] font-normal text-[var(--color-muted-foreground)]">· recommended</span>
        )}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-[var(--color-muted-foreground)]">{hint}</p>}
    </div>
  );
}

function ConsentRow({
  label,
  desc,
  required,
}: {
  label: string;
  desc?: string;
  required?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] p-3">
      <input type="checkbox" required={required} className="mt-0.5 size-4 accent-[var(--color-primary)]" />
      <span className="min-w-0 flex-1">
        <span className="text-sm font-medium">
          {label}
          {required && <span className="text-[var(--color-danger)]"> *</span>}
        </span>
        {desc && <span className="block text-[11px] text-[var(--color-muted-foreground)]">{desc}</span>}
      </span>
    </label>
  );
}

export default function RegisterPatientPage() {
  const router = useRouter();

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/admin/patients" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Patients
        </Link>
        <span>/</span>
        <span>Register patient</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Register a patient</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Create a patient record with demographics, contact, medical, and
          assignment details. An MRN is assigned automatically on save.
        </p>
      </div>

      <form
        className="max-w-5xl"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Patient registered", {
            description: "MRN assigned · clinician assigned · enrollment email sent · audit-logged",
          });
          router.push("/admin/patients");
        }}
      >
        <div className="grid gap-5 lg:grid-cols-[1.85fr_1fr]">
          {/* Form sections */}
          <div className="space-y-5">
            {/* A — Personal Information */}
            <Section icon={UserPlus2} title="A · Personal information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="first_name">
                  <Input id="first_name" placeholder="Aarav" required />
                </Field>
                <Field label="Last name" htmlFor="last_name">
                  <Input id="last_name" placeholder="Mehta" required />
                </Field>
                <Field label="Email" htmlFor="email" hint="Optional for admin-created records.">
                  <Input id="email" type="email" placeholder="patient@example.com" leadingIcon={<Mail />} />
                </Field>
                <Field label="Phone" htmlFor="phone">
                  <Input id="phone" type="tel" placeholder="+91 98765 43210" leadingIcon={<Phone />} required />
                </Field>
                <Field label="Date of birth" htmlFor="date_of_birth">
                  <Input id="date_of_birth" type="date" required />
                </Field>
                <Field label="Gender" htmlFor="gender">
                  <select id="gender" className={SELECT} defaultValue="" required>
                    <option value="" disabled>Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                    <option>Prefer not to say</option>
                  </select>
                </Field>
                <Field label="Blood group" htmlFor="blood_group">
                  <select id="blood_group" className={SELECT} defaultValue="">
                    <option value="">Select blood group</option>
                    {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Profile photo" htmlFor="profile_photo">
                  <Input id="profile_photo" type="file" accept="image/*" />
                </Field>
              </div>
            </Section>

            {/* B — Contact & Address */}
            <Section icon={MapPin} title="B · Contact & address">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Address line 1" htmlFor="address_line1" full recommended>
                  <Input id="address_line1" placeholder="Flat / house no., street" />
                </Field>
                <Field label="City" htmlFor="city" recommended>
                  <Input id="city" placeholder="Ahmedabad" />
                </Field>
                <Field label="Postal code" htmlFor="postal_code" recommended>
                  <Input id="postal_code" placeholder="380015" />
                </Field>
                <Field label="State" htmlFor="state" recommended>
                  <select id="state" className={SELECT} defaultValue="">
                    <option value="">Select state</option>
                    {STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Country" htmlFor="country">
                  <select id="country" className={SELECT} defaultValue="India" required>
                    <option>India</option>
                    <option>United States</option>
                    <option>United Kingdom</option>
                    <option>United Arab Emirates</option>
                    <option>Canada</option>
                    <option>Australia</option>
                  </select>
                </Field>
              </div>
            </Section>

            {/* C — Identity */}
            <Section icon={Fingerprint} title="C · Identity (India)">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Aadhaar number"
                  htmlFor="aadhaar_number"
                  locked
                  hint="Stored encrypted at rest."
                >
                  <Input id="aadhaar_number" placeholder="1234 5678 9012" inputMode="numeric" />
                </Field>
                <Field label="ABHA ID" htmlFor="abha_id">
                  <Input id="abha_id" placeholder="12-3456-7890-1234" />
                </Field>
              </div>
            </Section>

            {/* D — Emergency Contact */}
            <Section icon={Phone} title="D · Emergency contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact name" htmlFor="emergency_name" recommended>
                  <Input id="emergency_name" placeholder="Full name" />
                </Field>
                <Field label="Relationship" htmlFor="emergency_relation" recommended>
                  <select id="emergency_relation" className={SELECT} defaultValue="">
                    <option value="">Select relationship</option>
                    <option>Spouse</option>
                    <option>Parent</option>
                    <option>Sibling</option>
                    <option>Child</option>
                    <option>Friend</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Contact phone" htmlFor="emergency_phone" full recommended>
                  <Input id="emergency_phone" type="tel" placeholder="+91 98765 43210" leadingIcon={<Phone />} />
                </Field>
              </div>
            </Section>

            {/* E — Medical Information */}
            <Section icon={HeartPulse} title="E · Medical information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Allergies" htmlFor="allergies" full locked>
                  <Textarea id="allergies" rows={2} placeholder="Known allergies, if any" />
                </Field>
                <Field label="Chronic conditions" htmlFor="chronic_conditions" full locked>
                  <Textarea id="chronic_conditions" rows={2} placeholder="Diabetes, hypertension, etc." />
                </Field>
                <Field label="Current medications" htmlFor="current_medications" full locked>
                  <Textarea id="current_medications" rows={2} placeholder="Ongoing medications and dosages" />
                </Field>
                <Field label="Past surgeries" htmlFor="past_surgeries" full locked>
                  <Textarea id="past_surgeries" rows={2} placeholder="Procedures with approximate dates" />
                </Field>
                <Field label="Family history" htmlFor="family_history" full locked>
                  <Textarea id="family_history" rows={2} placeholder="Relevant hereditary conditions" />
                </Field>
              </div>
            </Section>

            {/* F — Insurance */}
            <Section icon={ShieldCheck} title="F · Insurance">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Insurance provider" htmlFor="insurance_provider">
                  <Input id="insurance_provider" placeholder="e.g., Star Health" />
                </Field>
                <Field label="Policy number" htmlFor="insurance_policy_number" locked hint="Stored encrypted at rest.">
                  <Input id="insurance_policy_number" placeholder="Policy / member ID" />
                </Field>
              </div>
            </Section>

            {/* G — Account & Consent */}
            <Section icon={Lock} title="G · Account & consent">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password" htmlFor="password" full hint="The patient can reset this after first sign-in.">
                  <Input id="password" type="password" placeholder="••••••••••••" autoComplete="new-password" required />
                </Field>
              </div>
              <div className="mt-4 space-y-2">
                <ConsentRow
                  label="Privacy policy consent"
                  desc="The patient agrees to the HealthSecure privacy policy."
                  required
                />
                <ConsentRow
                  label="Terms of service acceptance"
                  desc="The patient accepts the terms of service."
                  required
                />
              </div>
            </Section>

            {/* H — Assignment */}
            <Section icon={Stethoscope} title="H · Assignment">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Assigned clinician" htmlFor="assigned_clinician">
                  <select id="assigned_clinician" className={SELECT} defaultValue="" required>
                    <option value="" disabled>Select clinician</option>
                    {CLINICIANS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Department" htmlFor="department_id">
                  <select id="department_id" className={SELECT} defaultValue="" required>
                    <option value="" disabled>Select department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Patient type" htmlFor="patient_type">
                  <select id="patient_type" className={SELECT} defaultValue="">
                    <option value="">Select type</option>
                    <option>New</option>
                    <option>Returning</option>
                    <option>Referral</option>
                    <option>Walk-in</option>
                  </select>
                </Field>
                <Field label="Referral source" htmlFor="referral_source">
                  <Input id="referral_source" placeholder="e.g., Dr. Sharma's clinic" />
                </Field>
              </div>
            </Section>

            {/* I — Registration Meta */}
            <Section
              icon={Hash}
              title="I · Registration meta"
              hint="These values are generated by the system on save."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Registered by">
                  <Input value="Maya Iyer · Org Admin" readOnly className="bg-[var(--color-muted)]" />
                </Field>
                <Field label="Registration method">
                  <Input value="Admin portal" readOnly className="bg-[var(--color-muted)]" />
                </Field>
                <Field label="MRN">
                  <Input value="Auto-assigned on save" readOnly className="bg-[var(--color-muted)]" />
                </Field>
                <Field label="Patient ID">
                  <Input value="Auto-generated on save" readOnly className="bg-[var(--color-muted)]" />
                </Field>
              </div>
            </Section>

            {/* J — Visit Info */}
            <Section icon={ClipboardList} title="J · Visit info">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Visit reason" htmlFor="visit_reason" full>
                  <Textarea id="visit_reason" rows={2} placeholder="Reason for the first visit or registration" />
                </Field>
                <Field label="Preferred language" htmlFor="preferred_language">
                  <select id="preferred_language" className={SELECT} defaultValue="">
                    <option value="">Select language</option>
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Gujarati</option>
                    <option>Marathi</option>
                    <option>Tamil</option>
                    <option>Telugu</option>
                    <option>Bengali</option>
                  </select>
                </Field>
                <Field label="Preferred contact" htmlFor="preferred_contact">
                  <select id="preferred_contact" className={SELECT} defaultValue="">
                    <option value="">Select channel</option>
                    <option>Email</option>
                    <option>Phone call</option>
                    <option>SMS</option>
                    <option>WhatsApp</option>
                  </select>
                </Field>
              </div>
            </Section>
            {/* Footer — mirrors the sticky-sidebar actions for users who scroll past it */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                <ShieldCheck className="size-3.5" /> Patient registration is audit-logged
              </span>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/admin/patients">Cancel</Link>
                </Button>
                <Button type="submit">
                  <Send /> Register patient
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Ready to register
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Complete all sections, then create the patient record.
              </p>
              <Button type="submit" className="mt-4 w-full">
                <Send /> Register patient
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link href="/admin/patients">Cancel</Link>
              </Button>
              <span className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                <ShieldCheck className="size-3.5" /> Patient registration is audit-logged
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
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
                <Lock className="size-3.5" /> Fields marked with a lock are stored encrypted (PHI).
              </p>
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}
