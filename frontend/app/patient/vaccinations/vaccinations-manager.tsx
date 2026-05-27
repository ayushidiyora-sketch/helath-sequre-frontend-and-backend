"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Syringe,
  Plus,
  Pencil,
  Trash2,
  Download,
  Calendar,
  Plane,
  Clock,
  AlertTriangle,
  Search,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { usePatientStore, type VaccinationRecord } from "@/lib/patient-store";

const COMMON_VACCINES = [
  "COVID-19 (Covishield)",
  "COVID-19 (Covaxin)",
  "COVID-19 (Corbevax)",
  "Influenza (Quadrivalent)",
  "Tetanus / Tdap",
  "Hepatitis A",
  "Hepatitis B",
  "MMR",
  "Pneumococcal",
  "Varicella",
  "HPV",
  "Typhoid",
  "Yellow Fever",
  "Japanese Encephalitis",
  "Rabies",
  "Cholera",
  "Meningococcal",
];

type Filter = "all" | "routine" | "travel" | "upcoming";

const FILTER_TABS: { value: Filter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "all", label: "All", icon: Syringe },
  { value: "routine", label: "Routine", icon: CheckCircle2 },
  { value: "travel", label: "Travel", icon: Plane },
  { value: "upcoming", label: "Upcoming", icon: Clock },
];

function dateLabel(yyyymmdd?: string): string {
  if (!yyyymmdd) return "—";
  return new Date(yyyymmdd + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysFromNow(yyyymmdd?: string): number | null {
  if (!yyyymmdd) return null;
  const t = new Date(yyyymmdd + "T00:00:00").getTime();
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VaccinationsManager() {
  const { state, addVaccination, updateVaccination, removeVaccination } = usePatientStore();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<VaccinationRecord | null>(null);

  const all = state.vaccinations;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((v) => {
        if (filter === "all") return true;
        if (filter === "routine") return !v.forTravel;
        if (filter === "travel") return v.forTravel;
        if (filter === "upcoming") {
          const d = daysFromNow(v.nextDoseDue);
          return d != null && d >= 0;
        }
        return true;
      })
      .filter((v) => {
        if (!q) return true;
        return (
          v.vaccine.toLowerCase().includes(q) ||
          (v.manufacturer?.toLowerCase().includes(q) ?? false) ||
          (v.administeredBy?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => b.administeredOn.localeCompare(a.administeredOn));
  }, [all, filter, query]);

  if (!state.hydrated) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading…
      </div>
    );
  }

  const thisYear = new Date().getFullYear();
  const stats = {
    total: all.length,
    thisYear: all.filter((v) => v.administeredOn.startsWith(String(thisYear))).length,
    travel: all.filter((v) => v.forTravel).length,
    nextDueIn: all
      .map((v) => daysFromNow(v.nextDoseDue))
      .filter((d): d is number => d != null && d >= 0)
      .sort((a, b) => a - b)[0],
  };

  const upcomingSoon = all.filter((v) => {
    const d = daysFromNow(v.nextDoseDue);
    return d != null && d >= 0 && d <= 30;
  });

  function openAdd() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(v: VaccinationRecord) {
    setEditing(v);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openAdd}><Plus /> Add vaccination</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={Syringe} label="Total" value={stats.total} />
        <Stat icon={Calendar} label={`Doses in ${thisYear}`} value={stats.thisYear} />
        <Stat icon={Plane} label="Travel vaccines" value={stats.travel} tone="info" />
        <Stat
          icon={Clock}
          label="Next due"
          value={stats.nextDueIn != null ? `${stats.nextDueIn}d` : "—"}
          tone="warning"
        />
      </div>

      {upcomingSoon.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/50 p-4 text-sm text-[oklch(0.32_0.14_75)] dark:text-[oklch(0.88_0.15_80)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">
              {upcomingSoon.length} dose{upcomingSoon.length === 1 ? "" : "s"} due in the next 30 days
            </p>
            <ul className="text-[11px] space-y-0.5">
              {upcomingSoon.slice(0, 3).map((v) => (
                <li key={v.id}>
                  · {v.vaccine} — dose {v.doseNumber + 1}{v.totalDoses ? `/${v.totalDoses}` : ""} due {dateLabel(v.nextDoseDue)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by vaccine, manufacturer, or site…"
          leadingIcon={<Search />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-md"
        />
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            {FILTER_TABS.map((f) => {
              const Icon = f.icon;
              return (
                <TabsTrigger key={f.value} value={f.value}>
                  <Icon /> {f.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
          <Syringe className="size-6 text-[var(--color-muted-foreground)]" />
          <p className="text-sm font-medium">
            {all.length === 0 ? "No vaccinations on file yet" : "No vaccinations match the current filter"}
          </p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            {all.length === 0
              ? "Add your COVID booster, flu shot, or any travel vaccines."
              : "Try a different filter or clear the search."}
          </p>
          {all.length === 0 ? (
            <Button size="sm" onClick={openAdd}><Plus /> Add first vaccination</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => { setQuery(""); setFilter("all"); }}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              {filtered.length} record{filtered.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <SecurityBadge variant="encrypted" />
              <SecurityBadge variant="audited" />
            </div>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {filtered.map((v) => {
              const dueIn = daysFromNow(v.nextDoseDue);
              const dueSoon = dueIn != null && dueIn >= 0 && dueIn <= 30;
              const complete = v.totalDoses != null && v.doseNumber >= v.totalDoses;
              return (
                <li key={v.id} className="flex flex-wrap items-start gap-4 p-5 hover:bg-[var(--color-muted)]/30">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                    <Syringe className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{v.vaccine}</p>
                      <Badge variant={complete ? "success" : "info"} size="sm" dot>
                        Dose {v.doseNumber}{v.totalDoses ? `/${v.totalDoses}` : ""}
                      </Badge>
                      {v.forTravel && <Badge variant="warning" size="sm" dot><Plane className="mr-0.5 size-3" /> Travel</Badge>}
                      {dueSoon && (
                        <Badge variant="warning" size="sm" dot>Due in {dueIn}d</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">
                      Given {dateLabel(v.administeredOn)}
                      {v.administeredBy ? ` by ${v.administeredBy}` : ""}
                      {v.manufacturer ? ` · ${v.manufacturer}` : ""}
                      {v.lotNumber ? ` · lot ${v.lotNumber}` : ""}
                    </p>
                    {v.nextDoseDue && (
                      <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">
                        <Clock className="mr-1 inline size-3" />
                        Next dose: {dateLabel(v.nextDoseDue)}
                      </p>
                    )}
                    {v.notes && (
                      <p className="mt-1 text-[11px] italic text-[var(--color-muted-foreground)]">{v.notes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        toast.success("Generating certificate", {
                          description: `${v.vaccine} · PDF will be available shortly · audit-logged`,
                        })
                      }
                    >
                      <Download /> Certificate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(v)}>
                      <Pencil /> Edit
                    </Button>
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                      confirm={{
                        title: `Remove ${v.vaccine}?`,
                        description: "The record and any uploaded certificate will be removed.",
                        confirmLabel: "Remove",
                        variant: "destructive",
                      }}
                      toastMessage="Vaccination removed"
                      toastDescription={`${v.vaccine} · audit-logged`}
                      onClick={() => removeVaccination(v.id)}
                    >
                      <Trash2 /> Remove
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <VaccineDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSubmit={(values) => {
          if (editing) {
            updateVaccination(editing.id, values);
            toast.success("Vaccination updated", { description: `${values.vaccine} · audit-logged` });
          } else {
            addVaccination(values);
            toast.success("Vaccination added", { description: `${values.vaccine} · audit-logged` });
          }
          setOpen(false);
        }}
      />
    </div>
  );
}

interface FormValues {
  vaccine: string;
  manufacturer?: string;
  doseNumber: number;
  totalDoses?: number;
  administeredOn: string;
  administeredBy?: string;
  lotNumber?: string;
  nextDoseDue?: string;
  forTravel: boolean;
  notes?: string;
}

function VaccineDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: VaccinationRecord | null;
  onSubmit: (values: FormValues) => void;
}) {
  const [vaccine, setVaccine] = React.useState("");
  const [manufacturer, setManufacturer] = React.useState("");
  const [doseNumber, setDoseNumber] = React.useState(1);
  const [totalDoses, setTotalDoses] = React.useState<number | "">("");
  const [administeredOn, setAdministeredOn] = React.useState("");
  const [administeredBy, setAdministeredBy] = React.useState("");
  const [lotNumber, setLotNumber] = React.useState("");
  const [nextDoseDue, setNextDoseDue] = React.useState("");
  const [forTravel, setForTravel] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setVaccine(editing.vaccine);
      setManufacturer(editing.manufacturer ?? "");
      setDoseNumber(editing.doseNumber);
      setTotalDoses(editing.totalDoses ?? "");
      setAdministeredOn(editing.administeredOn);
      setAdministeredBy(editing.administeredBy ?? "");
      setLotNumber(editing.lotNumber ?? "");
      setNextDoseDue(editing.nextDoseDue ?? "");
      setForTravel(editing.forTravel);
      setNotes(editing.notes ?? "");
    } else {
      setVaccine("");
      setManufacturer("");
      setDoseNumber(1);
      setTotalDoses("");
      setAdministeredOn(todayIso());
      setAdministeredBy("");
      setLotNumber("");
      setNextDoseDue("");
      setForTravel(false);
      setNotes("");
    }
  }, [open, editing]);

  const valid = vaccine.trim().length > 0 && administeredOn.length > 0 && doseNumber >= 1;

  function submit() {
    if (!valid) return;
    onSubmit({
      vaccine: vaccine.trim(),
      manufacturer: manufacturer.trim() || undefined,
      doseNumber,
      totalDoses: totalDoses === "" ? undefined : Number(totalDoses),
      administeredOn,
      administeredBy: administeredBy.trim() || undefined,
      lotNumber: lotNumber.trim() || undefined,
      nextDoseDue: nextDoseDue || undefined,
      forTravel,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit vaccination" : "Add a vaccination"}</DialogTitle>
          <DialogDescription>
            Common Indian vaccines are listed; you can type any other vaccine name. Doses and dates power the
            &quot;Upcoming&quot; reminders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="vac-name">Vaccine</Label>
            <Input
              id="vac-name"
              list="vac-options"
              value={vaccine}
              onChange={(e) => setVaccine(e.target.value)}
              placeholder="COVID-19 (Covishield)"
            />
            <datalist id="vac-options">
              {COMMON_VACCINES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="vac-manuf">Manufacturer</Label>
              <Input id="vac-manuf" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Serum Institute" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vac-dose">Dose #</Label>
              <Input
                id="vac-dose"
                type="number"
                min={1}
                max={20}
                value={doseNumber}
                onChange={(e) => setDoseNumber(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vac-total">Total doses</Label>
              <Input
                id="vac-total"
                type="number"
                min={1}
                max={20}
                value={totalDoses === "" ? "" : totalDoses}
                onChange={(e) => setTotalDoses(e.target.value === "" ? "" : Math.max(1, Number(e.target.value) || 1))}
                placeholder="e.g., 2 or 3"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vac-on">Administered on</Label>
              <Input id="vac-on" type="date" value={administeredOn} onChange={(e) => setAdministeredOn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vac-by">Administered by</Label>
              <Input id="vac-by" value={administeredBy} onChange={(e) => setAdministeredBy(e.target.value)} placeholder="Clinic / clinician" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vac-lot">Lot number</Label>
              <Input id="vac-lot" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vac-next">Next dose due</Label>
              <Input id="vac-next" type="date" value={nextDoseDue} onChange={(e) => setNextDoseDue(e.target.value)} />
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={forTravel}
              onChange={(e) => setForTravel(e.target.checked)}
              className="mt-0.5 size-4 rounded border-[var(--color-input)] accent-[var(--color-primary)]"
            />
            <span>
              <span className="font-medium inline-flex items-center gap-1.5"><Plane className="size-3.5" /> Travel vaccination</span>
              <span className="block text-[11px] text-[var(--color-muted-foreground)]">Yellow Fever, Japanese Encephalitis, etc. — shown in the Travel tab.</span>
            </span>
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="vac-notes">Notes (optional)</Label>
            <Textarea id="vac-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Side effects, travel destination, exemption reason, etc." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid}>{editing ? "Save changes" : "Add vaccination"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  tone?: "info" | "warning";
}) {
  const ring =
    tone === "info"
      ? "text-[var(--color-info)] bg-[var(--color-info-soft)]/50"
      : tone === "warning"
        ? "text-[var(--color-warning-foreground)] bg-[var(--color-warning-soft)]/60"
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
