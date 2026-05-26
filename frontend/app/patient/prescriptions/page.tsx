import Link from "next/link";
import {
  Pill,
  Calendar,
  ArrowRight,
  Download,
  RefreshCw,
  ClipboardList,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/shared/action-button";
import { SecurityBadge } from "@/components/shared/security-badge";
import { RECORDS, type RecordDetail } from "../records/records-data";

const PRESCRIPTIONS: RecordDetail[] = RECORDS.filter(
  (r): r is RecordDetail & { prescription: NonNullable<RecordDetail["prescription"]> } =>
    r.category === "Prescription" && !!r.prescription,
);

export const metadata = {
  title: "Prescriptions",
  description: "Active and past prescriptions issued by your care team.",
};

export default function PrescriptionsPage() {
  const active = PRESCRIPTIONS.filter((r) => r.status === "Active");
  const past = PRESCRIPTIONS.filter((r) => r.status !== "Active");

  return (
    <>
      <PageHeader
        eyebrow="Prescriptions"
        title="Your medications"
        description="Active and past prescriptions issued by your care team. Refill requests route to the prescribing clinician."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active" value={active.length} icon={Pill} accent />
        <Stat label="Past" value={past.length} icon={ClipboardList} />
        <Stat label="Refill credits left" value={active.reduce((s, r) => s + Number(r.prescription!.refills || 0), 0)} icon={RefreshCw} />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active · {active.length}</TabsTrigger>
          <TabsTrigger value="past">Past · {past.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {active.length === 0 ? (
            <Empty label="No active prescriptions." />
          ) : (
            <div className="space-y-3">
              {active.map((r) => <Card key={r.id} record={r} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past">
          {past.length === 0 ? (
            <Empty label="No past prescriptions." />
          ) : (
            <div className="space-y-3">
              {past.map((r) => <Card key={r.id} record={r} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
        Prescriptions and refills are audit-logged. Critical interactions trigger a clinician review.
      </p>
    </>
  );
}

function Card({ record }: { record: RecordDetail }) {
  const rx = record.prescription!;
  const isActive = record.status === "Active";
  return (
    <div
      className={`overflow-hidden rounded-2xl border p-5 ${
        isActive
          ? "border-[var(--color-primary)]/30 bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[var(--color-primary-50)]/40"
          : "border-[var(--color-border)] bg-[var(--color-card)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)] text-white shadow-[var(--shadow-soft)]">
            <Pill className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{rx.drug} · {rx.strength}</h3>
              {isActive ? (
                <Badge variant="success" size="sm" dot>Active</Badge>
              ) : (
                <Badge variant="muted" size="sm">Past</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              {rx.form} · {rx.frequency} · {rx.duration}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
              <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> Prescribed {record.date}</span>
              <span className="inline-flex items-center gap-1">By {record.clinician}</span>
              <SecurityBadge variant="audited" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Fact label="Refills left" value={rx.refills} mono />
        <Fact label="Status" value={isActive ? "Filled · take as prescribed" : "Completed"} />
        <Fact label="Source" value={record.facility} />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        <p className="font-semibold text-[var(--color-foreground)]">Instructions</p>
        <p className="mt-1">{rx.instructions}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/patient/records/${record.id}`}>
            View full record <ArrowRight />
          </Link>
        </Button>
        {isActive && (
          <ActionButton
            size="sm"
            confirm={{
              title: `Request a refill for ${rx.drug}?`,
              description: `The request will be sent to ${record.clinician} for review. You'll be notified when it's approved.`,
              confirmLabel: "Request refill",
            }}
            toastMessage="Refill requested"
            toastDescription={`${rx.drug} · awaiting clinician review · audit-logged`}
          >
            <RefreshCw /> Request refill
          </ActionButton>
        )}
        <ActionButton
          variant="ghost"
          size="sm"
          toastMessage="Download started"
          toastDescription={`${rx.drug} · PDF`}
          toastVariant="info"
        >
          <Download /> Download
        </ActionButton>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
        <Icon className={`size-3.5 ${accent ? "text-[var(--color-primary-700)]" : ""}`} /> {label}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className={`mt-1 text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
      <CheckCircle2 className="mx-auto size-8 text-[var(--color-success)]" />
      <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-muted-foreground)]">
        <Clock className="size-3" /> Check back after your next visit
      </p>
    </div>
  );
}
