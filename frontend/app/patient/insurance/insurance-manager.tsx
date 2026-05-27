"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Building2,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  FileUp,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ActionButton } from "@/components/shared/action-button";
import {
  usePatientStore,
  type InsurancePlan,
  type InsuranceCoverageType,
  type PreAuthStatus,
} from "@/lib/patient-store";

const COVERAGE_TYPES: InsuranceCoverageType[] = ["Self", "Family", "Spouse", "Children"];

function maskPolicy(input: string): string {
  const cleaned = input.replace(/\s/g, "");
  if (cleaned.length <= 4) return cleaned.toUpperCase();
  return `XXXXXX${cleaned.slice(-4).toUpperCase()}`;
}

function dateLabel(yyyymmdd?: string): string {
  if (!yyyymmdd) return "—";
  return new Date(yyyymmdd + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(yyyymmdd?: string): number | null {
  if (!yyyymmdd) return null;
  const target = new Date(yyyymmdd + "T00:00:00").getTime();
  return Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000));
}

function preAuthVariant(s: PreAuthStatus): "muted" | "warning" | "success" | "danger" {
  switch (s) {
    case "pending": return "warning";
    case "approved": return "success";
    case "denied": return "danger";
    default: return "muted";
  }
}

function preAuthIcon(s: PreAuthStatus) {
  switch (s) {
    case "pending": return Clock;
    case "approved": return CheckCircle2;
    case "denied": return XCircle;
    default: return ShieldCheck;
  }
}

export function InsuranceManager() {
  const {
    state,
    addInsurancePlan,
    updateInsurancePlan,
    removeInsurancePlan,
    markPrimaryInsurance,
  } = usePatientStore();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InsurancePlan | null>(null);

  if (!state.hydrated) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading…
      </div>
    );
  }

  const plans = state.insurance;
  const primary = plans.find((p) => p.isPrimary);

  // Find soonest renewal across plans (any plan ending within 90 days).
  const nextRenewal = plans
    .map((p) => p.endDate)
    .filter((d): d is string => Boolean(d))
    .map((d) => ({ d, days: daysUntil(d) ?? Infinity }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

  function openAdd() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(p: InsurancePlan) {
    setEditing(p);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openAdd}><Plus /> Add insurance plan</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={ShieldCheck} label="Active plans" value={plans.length} />
        <Stat icon={Star} label="Primary" value={primary?.provider ?? "—"} tone="success" />
        <Stat icon={CreditCard} label="Claims this year" value="0" tone="info" />
        <Stat
          icon={Calendar}
          label="Next renewal"
          value={nextRenewal ? dateLabel(nextRenewal.d) : "—"}
        />
      </div>

      {nextRenewal && nextRenewal.days <= 30 && (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/50 p-4 text-sm text-[oklch(0.32_0.14_75)] dark:text-[oklch(0.88_0.15_80)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            A plan expires in <b>{nextRenewal.days} day{nextRenewal.days === 1 ? "" : "s"}</b> ({dateLabel(nextRenewal.d)}). Renew it to avoid a coverage gap.
          </span>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
          <ShieldCheck className="size-6 text-[var(--color-muted-foreground)]" />
          <p className="text-sm font-medium">No insurance plans on file</p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            Add at least one plan so clinics can verify your cashless cover.
          </p>
          <Button size="sm" onClick={openAdd}><Plus /> Add your first plan</Button>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {plans.map((p) => {
            const PaIcon = preAuthIcon(p.preAuthorizationStatus);
            return (
              <div
                key={p.id}
                className={`overflow-hidden rounded-2xl border bg-gradient-to-br p-5 ${
                  p.isPrimary
                    ? "border-[var(--color-primary)]/30 from-[var(--color-primary-50)] to-[var(--color-card)]"
                    : "border-[var(--color-border)] from-[var(--color-card)] to-[var(--color-card)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-card)] text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary)]/20">
                      <Building2 className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{p.provider}</p>
                      <p className="text-[11px] text-[var(--color-muted-foreground)]">{p.planName}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {p.isPrimary && <Badge variant="success" size="sm" dot>Primary</Badge>}
                        <Badge variant="muted" size="sm">{p.coverageType}</Badge>
                        <Badge variant={preAuthVariant(p.preAuthorizationStatus)} size="sm" dot>
                          <PaIcon className="mr-0.5 size-3" />
                          Pre-auth: {p.preAuthorizationStatus === "none" ? "n/a" : p.preAuthorizationStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <dl className="mt-4 space-y-1.5 text-xs">
                  <Row label="Policy #" value={p.policyNumberMasked} mono />
                  {p.groupNumber && <Row label="Group #" value={p.groupNumber} mono />}
                  {p.memberId && <Row label="Member ID" value={p.memberId} mono />}
                  <Row label="Valid" value={`${dateLabel(p.startDate)} → ${p.endDate ? dateLabel(p.endDate) : "ongoing"}`} />
                  {p.cardFrontFileName && (
                    <Row
                      label="Card on file"
                      value={
                        <span className="inline-flex items-center gap-1 text-[var(--color-primary-700)]">
                          <FileUp className="size-3" /> {p.cardFrontFileName}
                        </span>
                      }
                    />
                  )}
                </dl>

                {p.notes && (
                  <p className="mt-3 rounded-md bg-[var(--color-muted)]/40 px-2.5 py-1.5 text-[11px] italic text-[var(--color-muted-foreground)]">
                    {p.notes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {!p.isPrimary && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        markPrimaryInsurance(p.id);
                        toast.success("Primary plan updated", { description: `${p.provider} · audit-logged` });
                      }}
                    >
                      <Star /> Mark as primary
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil /> Edit
                  </Button>
                  <ActionButton
                    size="sm"
                    variant="ghost"
                    className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                    confirm={{
                      title: `Remove ${p.provider}?`,
                      description: "The plan and any uploaded card images will be removed. Claims history is unaffected.",
                      confirmLabel: "Remove plan",
                      variant: "destructive",
                    }}
                    toastMessage="Insurance plan removed"
                    toastDescription={`${p.provider} · audit-logged`}
                    onClick={() => removeInsurancePlan(p.id)}
                  >
                    <Trash2 /> Remove
                  </ActionButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-xs text-[var(--color-muted-foreground)]">
        Card images and policy numbers are encrypted at rest.
        <SecurityBadge variant="encrypted" />
        <SecurityBadge variant="audited" />
      </div>

      <InsuranceDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        existingHasPrimary={plans.some((p) => p.isPrimary)}
        onSubmit={(values) => {
          if (editing) {
            updateInsurancePlan(editing.id, values);
            toast.success("Insurance plan updated", { description: `${values.provider} · audit-logged` });
            if (values.isPrimary && !editing.isPrimary) markPrimaryInsurance(editing.id);
          } else {
            addInsurancePlan(values);
            toast.success("Insurance plan added", { description: `${values.provider} · audit-logged` });
          }
          setOpen(false);
        }}
      />
    </div>
  );
}

interface FormValues {
  provider: string;
  planName: string;
  policyNumberMasked: string;
  groupNumber?: string;
  memberId?: string;
  coverageType: InsuranceCoverageType;
  startDate: string;
  endDate?: string;
  isPrimary: boolean;
  cardFrontFileName?: string;
  cardBackFileName?: string;
  preAuthorizationStatus: PreAuthStatus;
  notes?: string;
}

function InsuranceDialog({
  open,
  onOpenChange,
  editing,
  existingHasPrimary,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: InsurancePlan | null;
  existingHasPrimary: boolean;
  onSubmit: (values: FormValues) => void;
}) {
  const [provider, setProvider] = React.useState("");
  const [planName, setPlanName] = React.useState("");
  const [policyRaw, setPolicyRaw] = React.useState("");
  const [groupNumber, setGroupNumber] = React.useState("");
  const [memberId, setMemberId] = React.useState("");
  const [coverageType, setCoverageType] = React.useState<InsuranceCoverageType>("Self");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [isPrimary, setIsPrimary] = React.useState(false);
  const [cardFile, setCardFile] = React.useState<string | undefined>(undefined);
  const [preAuth, setPreAuth] = React.useState<PreAuthStatus>("none");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setProvider(editing.provider);
      setPlanName(editing.planName);
      setPolicyRaw(editing.policyNumberMasked);
      setGroupNumber(editing.groupNumber ?? "");
      setMemberId(editing.memberId ?? "");
      setCoverageType(editing.coverageType);
      setStartDate(editing.startDate);
      setEndDate(editing.endDate ?? "");
      setIsPrimary(editing.isPrimary);
      setCardFile(editing.cardFrontFileName);
      setPreAuth(editing.preAuthorizationStatus);
      setNotes(editing.notes ?? "");
    } else {
      setProvider("");
      setPlanName("");
      setPolicyRaw("");
      setGroupNumber("");
      setMemberId("");
      setCoverageType("Self");
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate("");
      setIsPrimary(!existingHasPrimary);
      setCardFile(undefined);
      setPreAuth("none");
      setNotes("");
    }
  }, [open, editing, existingHasPrimary]);

  const valid = provider.trim() && planName.trim() && policyRaw.trim() && startDate;

  function pickCard() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".pdf,.jpg,.jpeg,.png";
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (f) setCardFile(f.name);
    };
    inp.click();
  }

  function submit() {
    if (!valid) return;
    onSubmit({
      provider: provider.trim(),
      planName: planName.trim(),
      policyNumberMasked: maskPolicy(policyRaw),
      groupNumber: groupNumber.trim() || undefined,
      memberId: memberId.trim() || undefined,
      coverageType,
      startDate,
      endDate: endDate || undefined,
      isPrimary,
      cardFrontFileName: cardFile,
      preAuthorizationStatus: preAuth,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit insurance plan" : "Add an insurance plan"}</DialogTitle>
          <DialogDescription>
            Policy numbers are masked automatically. Only the last 4 digits are retained for display.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ins-provider">Provider</Label>
              <Input id="ins-provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Star Health" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-plan">Plan name</Label>
              <Input id="ins-plan" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Family Health Optima" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ins-policy">Policy number</Label>
              <Input
                id="ins-policy"
                value={policyRaw}
                onChange={(e) => setPolicyRaw(e.target.value)}
                placeholder="Full number — will be masked"
              />
              {policyRaw && (
                <p className="text-[11px] text-[var(--color-muted-foreground)]">
                  Will be stored as <span className="font-mono">{maskPolicy(policyRaw)}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-coverage">Coverage type</Label>
              <select
                id="ins-coverage"
                value={coverageType}
                onChange={(e) => setCoverageType(e.target.value as InsuranceCoverageType)}
                className="flex h-10 w-full appearance-none rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
              >
                {COVERAGE_TYPES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ins-group">Group # (optional)</Label>
              <Input id="ins-group" value={groupNumber} onChange={(e) => setGroupNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-member">Member ID (optional)</Label>
              <Input id="ins-member" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ins-start">Start date</Label>
              <Input id="ins-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins-end">End date (optional)</Label>
              <Input id="ins-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ins-preauth">Pre-authorization status</Label>
              <select
                id="ins-preauth"
                value={preAuth}
                onChange={(e) => setPreAuth(e.target.value as PreAuthStatus)}
                className="flex h-10 w-full appearance-none rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
              >
                <option value="none">Not required</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Card image (optional)</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={pickCard}><FileUp /> Upload card</Button>
                {cardFile && <span className="self-center text-[11px] text-[var(--color-muted-foreground)]">{cardFile}</span>}
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="mt-0.5 size-4 rounded border-[var(--color-input)] accent-[var(--color-primary)]"
            />
            <span>
              <span className="font-medium">Mark as my primary plan</span>
              <span className="block text-[11px] text-[var(--color-muted-foreground)]">Clinics will attempt cashless cover against this plan first.</span>
            </span>
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="ins-notes">Notes (optional)</Label>
            <Textarea id="ins-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Network coverage, special conditions, top-up details…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid}>{editing ? "Save changes" : "Add plan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className={`text-right font-medium ${mono ? "font-mono text-[11px]" : ""}`}>{value}</dd>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: "success" | "info";
}) {
  const ring =
    tone === "success"
      ? "text-[var(--color-success)] bg-[var(--color-success-soft)]/50"
      : tone === "info"
        ? "text-[var(--color-info)] bg-[var(--color-info-soft)]/50"
        : "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <span className={`flex size-5 items-center justify-center rounded-md ${ring}`}>
          <Icon className="size-3" />
        </span>
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
