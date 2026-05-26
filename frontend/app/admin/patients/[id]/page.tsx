import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  User,
  MapPin,
  Fingerprint,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  Hash,
  ClipboardList,
  Lock,
  Pencil,
  Ban,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { PATIENTS, getPatient } from "../patients-data";
import { AssignmentsCard } from "./assignments-card";

export function generateStaticParams() {
  return PATIENTS.map((p) => ({ id: p.id }));
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4" /> {title}
      </h2>
      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
  locked,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  locked?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2 lg:col-span-3" : ""}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
        {locked && <Lock className="size-3" />}
      </p>
      <p className={`mt-0.5 text-sm ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = getPatient(id);
  if (!p) notFound();

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/admin/patients" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Patients
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">{p.name}</span>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14 text-base">
              <AvatarFallback>{p.initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{p.name}</h1>
                {p.status === "active" ? (
                  <Badge variant="success" size="sm" dot>Active</Badge>
                ) : (
                  <Badge variant="muted" size="sm">Deactivated</Badge>
                )}
                <Badge variant="muted" size="sm">{p.patientType}</Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-[var(--color-muted-foreground)]">
                MRN {p.mrn} · {p.patientId}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                {p.department} · {p.clinician} · enrolled {p.since}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/patients/${p.id}/edit`}>
                <Pencil /> Edit details
              </Link>
            </Button>
            {p.status === "active" ? (
              <ActionButton
                variant="outline"
                size="sm"
                className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                confirm={{
                  title: `Deactivate ${p.name}?`,
                  description:
                    "The patient loses portal access. The record and audit trail are preserved. This action is audit-logged.",
                  confirmLabel: "Deactivate",
                  variant: "destructive",
                }}
                toastMessage={`${p.name} deactivated`}
                toastDescription="Audit-logged"
                toastVariant="warning"
              >
                <Ban /> Deactivate
              </ActionButton>
            ) : (
              <ActionButton
                variant="outline"
                size="sm"
                toastMessage={`${p.name} reactivated`}
                toastDescription="Portal access restored · audit-logged"
              >
                <RotateCcw /> Reactivate
              </ActionButton>
            )}
          </div>
        </div>
      </div>

      {/* Assignments + consent gate */}
      <AssignmentsCard patientId={p.id} />

      {/* A — Personal */}
      <Section icon={User} title="A · Personal information">
        <Info label="First name" value={p.firstName} />
        <Info label="Last name" value={p.lastName} />
        <Info label="Date of birth" value={p.dob} />
        <Info label="Gender" value={p.gender} />
        <Info label="Blood group" value={p.bloodGroup} />
        <Info label="Email" value={p.email} />
        <Info label="Phone" value={p.phone} />
      </Section>

      {/* B — Contact & address */}
      <Section icon={MapPin} title="B · Contact & address">
        <Info label="Address" value={p.address} full />
        <Info label="City" value={p.city} />
        <Info label="State" value={p.state} />
        <Info label="Postal code" value={p.postalCode} />
        <Info label="Country" value={p.country} />
      </Section>

      {/* C — Identity */}
      <Section icon={Fingerprint} title="C · Identity (India)">
        <Info label="Aadhaar number" value={p.aadhaarMasked} mono locked />
        <Info label="ABHA ID" value={p.abhaId} mono />
      </Section>

      {/* D — Emergency contact */}
      <Section icon={User} title="D · Emergency contact">
        <Info label="Contact name" value={p.emergencyName} />
        <Info label="Relationship" value={p.emergencyRelation} />
        <Info label="Contact phone" value={p.emergencyPhone} />
      </Section>

      {/* E — Medical information (PHI — restricted) */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <HeartPulse className="size-4" /> E · Medical information
        </h2>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4">
          <Lock className="mt-0.5 size-4 shrink-0 text-[var(--color-muted-foreground)]" />
          <div>
            <p className="text-sm font-medium">Medical PHI is not visible to Org Admin</p>
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              Allergies, conditions, medications, and history are consent-bound and
              visible only to the patient and assigned clinicians.
            </p>
          </div>
        </div>
      </div>

      {/* F — Insurance */}
      <Section icon={ShieldCheck} title="F · Insurance">
        <Info label="Provider" value={p.insuranceProvider} />
        <Info label="Policy number" value={p.insurancePolicyMasked} mono locked />
      </Section>

      {/* H — Assignment */}
      <Section icon={Stethoscope} title="H · Assignment">
        <Info label="Assigned clinician" value={p.clinician} />
        <Info label="Department" value={p.department} />
        <Info label="Patient type" value={p.patientType} />
        <Info label="Referral source" value={p.referralSource} />
      </Section>

      {/* I — Registration meta */}
      <Section icon={Hash} title="I · Registration meta">
        <Info label="Registered by" value={p.registeredBy} />
        <Info label="Registration method" value={p.registrationMethod} />
        <Info label="Registered on" value={p.registeredOn} />
        <Info label="MRN" value={p.mrn} mono />
        <Info label="Patient ID" value={p.patientId} mono />
      </Section>

      {/* J — Visit info */}
      <Section icon={ClipboardList} title="J · Visit info">
        <Info label="Visit reason" value={p.visitReason} full />
        <Info label="Preferred language" value={p.preferredLanguage} />
        <Info label="Preferred contact" value={p.preferredContact} />
      </Section>
    </>
  );
}
