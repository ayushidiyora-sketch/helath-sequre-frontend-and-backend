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
  Save,
  CheckCircle2,
  Stethoscope,
  Hash,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, PasswordInput, Textarea } from "@/components/ui/input";
import type { PatientRecord } from "../../patients-data";

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
  "Dr. Priya Shah",
  "Dr. Rohan Iyer",
  "Dr. Neha Kapoor",
  "Dr. Aisha Khan",
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
  defaultChecked,
}: {
  label: string;
  desc?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] p-3">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 accent-[var(--color-primary)]"
      />
      <span className="min-w-0 flex-1">
        <span className="text-sm font-medium">{label}</span>
        {desc && <span className="block text-[11px] text-[var(--color-muted-foreground)]">{desc}</span>}
      </span>
    </label>
  );
}

export function EditPatientForm({ patient: p }: { patient: PatientRecord }) {
  const router = useRouter();

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/admin/patients" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Patients
        </Link>
        <span>/</span>
        <Link href={`/admin/patients/${p.id}`} className="hover:text-[var(--color-foreground)]">
          {p.name}
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">Edit</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Edit patient details</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Update {p.name}&apos;s record. Changes are audit-logged.
        </p>
      </div>

      <form
        className="max-w-5xl"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Patient details updated", {
            description: `${p.name} · changes saved · audit-logged`,
          });
          router.push(`/admin/patients/${p.id}`);
        }}
      >
        <div className="grid gap-5 lg:grid-cols-[1.85fr_1fr]">
          {/* Form sections */}
          <div className="space-y-5">
            {/* A — Personal Information */}
            <Section icon={UserPlus2} title="A · Personal information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="first_name">
                  <Input id="first_name" defaultValue={p.firstName} required />
                </Field>
                <Field label="Last name" htmlFor="last_name">
                  <Input id="last_name" defaultValue={p.lastName} required />
                </Field>
                <Field label="Email" htmlFor="email" hint="Optional for admin-created records.">
                  <Input id="email" type="email" defaultValue={p.email} leadingIcon={<Mail />} />
                </Field>
                <Field label="Phone" htmlFor="phone">
                  <Input id="phone" type="tel" defaultValue={p.phone} leadingIcon={<Phone />} required />
                </Field>
                <Field label="Date of birth" htmlFor="date_of_birth">
                  <Input id="date_of_birth" type="date" defaultValue={p.dob} required />
                </Field>
                <Field label="Gender" htmlFor="gender">
                  <select id="gender" className={SELECT} defaultValue={p.gender} required>
                    <option value="" disabled>Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                    <option>Prefer not to say</option>
                  </select>
                </Field>
                <Field label="Blood group" htmlFor="blood_group">
                  <select id="blood_group" className={SELECT} defaultValue={p.bloodGroup}>
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
                  <Input id="address_line1" defaultValue={p.address} />
                </Field>
                <Field label="City" htmlFor="city" recommended>
                  <Input id="city" defaultValue={p.city} />
                </Field>
                <Field label="Postal code" htmlFor="postal_code" recommended>
                  <Input id="postal_code" defaultValue={p.postalCode} />
                </Field>
                <Field label="State" htmlFor="state" recommended>
                  <select id="state" className={SELECT} defaultValue={p.state}>
                    <option value="">Select state</option>
                    {STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Country" htmlFor="country">
                  <select id="country" className={SELECT} defaultValue={p.country} required>
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
                  <Input id="aadhaar_number" defaultValue={p.aadhaarMasked} inputMode="numeric" />
                </Field>
                <Field label="ABHA ID" htmlFor="abha_id">
                  <Input id="abha_id" defaultValue={p.abhaId} />
                </Field>
              </div>
            </Section>

            {/* D — Emergency Contact */}
            <Section icon={Phone} title="D · Emergency contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact name" htmlFor="emergency_name" recommended>
                  <Input id="emergency_name" defaultValue={p.emergencyName} />
                </Field>
                <Field label="Relationship" htmlFor="emergency_relation" recommended>
                  <select id="emergency_relation" className={SELECT} defaultValue={p.emergencyRelation}>
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
                  <Input id="emergency_phone" type="tel" defaultValue={p.emergencyPhone} leadingIcon={<Phone />} />
                </Field>
              </div>
            </Section>

            {/* E — Medical Information */}
            <Section
              icon={HeartPulse}
              title="E · Medical information"
              hint="Medical PHI is consent-bound — leave blank unless explicitly provided."
            >
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
                  <Input id="insurance_provider" defaultValue={p.insuranceProvider} />
                </Field>
                <Field label="Policy number" htmlFor="insurance_policy_number" locked hint="Stored encrypted at rest.">
                  <Input id="insurance_policy_number" defaultValue={p.insurancePolicyMasked} />
                </Field>
              </div>
            </Section>

            {/* G — Account & Consent */}
            <Section icon={Lock} title="G · Account & consent">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Reset password"
                  htmlFor="password"
                  full
                  hint="Leave blank to keep the current password unchanged."
                >
                  <PasswordInput id="password" placeholder="••••••••••••" autoComplete="new-password" />
                </Field>
              </div>
              <div className="mt-4 space-y-2">
                <ConsentRow
                  label="Privacy policy consent"
                  desc="The patient agrees to the HealthSecure privacy policy."
                  defaultChecked
                />
                <ConsentRow
                  label="Terms of service acceptance"
                  desc="The patient accepts the terms of service."
                  defaultChecked
                />
              </div>
            </Section>

            {/* H — Assignment */}
            <Section icon={Stethoscope} title="H · Assignment">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Assigned clinician" htmlFor="assigned_clinician">
                  <select id="assigned_clinician" className={SELECT} defaultValue={p.clinician} required>
                    <option value="" disabled>Select clinician</option>
                    {CLINICIANS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Department" htmlFor="department_id">
                  <select id="department_id" className={SELECT} defaultValue={p.department} required>
                    <option value="" disabled>Select department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Patient type" htmlFor="patient_type">
                  <select id="patient_type" className={SELECT} defaultValue={p.patientType}>
                    <option value="">Select type</option>
                    <option>New</option>
                    <option>Returning</option>
                    <option>Referral</option>
                    <option>Walk-in</option>
                  </select>
                </Field>
                <Field label="Referral source" htmlFor="referral_source">
                  <Input id="referral_source" defaultValue={p.referralSource} />
                </Field>
              </div>
            </Section>

            {/* I — Registration Meta */}
            <Section icon={Hash} title="I · Registration meta" hint="System-managed — read-only.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Registered by">
                  <Input value={p.registeredBy} readOnly className="bg-[var(--color-muted)]" />
                </Field>
                <Field label="Registration method">
                  <Input value={p.registrationMethod} readOnly className="bg-[var(--color-muted)]" />
                </Field>
                <Field label="MRN">
                  <Input value={p.mrn} readOnly className="bg-[var(--color-muted)] font-mono" />
                </Field>
                <Field label="Patient ID">
                  <Input value={p.patientId} readOnly className="bg-[var(--color-muted)] font-mono" />
                </Field>
              </div>
            </Section>

            {/* J — Visit Info */}
            <Section icon={ClipboardList} title="J · Visit info">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Visit reason" htmlFor="visit_reason" full>
                  <Textarea id="visit_reason" rows={2} defaultValue={p.visitReason} />
                </Field>
                <Field label="Preferred language" htmlFor="preferred_language">
                  <select id="preferred_language" className={SELECT} defaultValue={p.preferredLanguage}>
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
                  <select id="preferred_contact" className={SELECT} defaultValue={p.preferredContact}>
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
                <ShieldCheck className="size-3.5" /> Updates are audit-logged
              </span>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href={`/admin/patients/${p.id}`}>Cancel</Link>
                </Button>
                <Button type="submit">
                  <Save /> Save changes
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Editing
              </p>
              <p className="mt-1 text-sm font-semibold">{p.name}</p>
              <p className="font-mono text-[11px] text-[var(--color-muted-foreground)]">{p.mrn}</p>
              <Button type="submit" className="mt-4 w-full">
                <Save /> Save changes
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link href={`/admin/patients/${p.id}`}>Cancel</Link>
              </Button>
              <span className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                <ShieldCheck className="size-3.5" /> Updates are audit-logged
              </span>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <p className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
                <CheckCircle2 className="size-3.5 text-[var(--color-success)]" /> Changes apply immediately on save.
              </p>
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
