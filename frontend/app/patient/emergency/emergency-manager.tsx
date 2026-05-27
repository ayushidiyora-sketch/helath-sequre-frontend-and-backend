"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Heart,
  Pill,
  Plus,
  X,
  Phone,
  ShieldCheck,
  Pencil,
  Save,
  Hospital,
  Droplet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { SecurityBadge } from "@/components/shared/security-badge";
import {
  usePatientStore,
  type BloodGroup,
  type EmergencyContact,
} from "@/lib/patient-store";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

export function EmergencyManager() {
  const { state, updateEmergencyContact } = usePatientStore();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<EmergencyContact | null>(null);

  if (!state.hydrated) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading…
      </div>
    );
  }

  const ec = state.emergencyContact;
  const view = editing && draft ? draft : ec;

  function startEdit() {
    setDraft({ ...ec });
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  function save() {
    if (!draft) return;
    updateEmergencyContact(draft);
    toast.success("Emergency information saved", {
      description: "Visible to ER teams · audit-logged",
    });
    setEditing(false);
    setDraft(null);
  }

  function patchDraft(patch: Partial<EmergencyContact>) {
    setDraft((curr) => (curr ? { ...curr, ...patch } : curr));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2">
        {editing ? (
          <>
            <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
            <Button size="sm" onClick={save}><Save /> Save changes</Button>
          </>
        ) : (
          <Button size="sm" onClick={startEdit}><Pencil /> Edit</Button>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/50 p-4 text-sm text-[oklch(0.32_0.14_75)] dark:text-[oklch(0.88_0.15_80)]">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          This information is shown to emergency staff during ER visits. Inaccurate or out-of-date info can lead to harm. Every change is audit-logged.
        </p>
      </div>

      {/* Primary + secondary contacts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Primary contact" icon={Phone}>
          <Field
            label="Name"
            value={view.primaryName}
            editing={editing}
            onChange={(v) => patchDraft({ primaryName: v })}
          />
          <Field
            label="Relationship"
            value={view.primaryRelationship}
            editing={editing}
            onChange={(v) => patchDraft({ primaryRelationship: v })}
          />
          <Field
            label="Phone"
            type="tel"
            value={view.primaryPhone}
            editing={editing}
            onChange={(v) => patchDraft({ primaryPhone: v })}
          />
        </Section>

        <Section title="Secondary contact (optional)" icon={Phone} muted>
          <Field
            label="Name"
            value={view.secondaryName ?? ""}
            editing={editing}
            onChange={(v) => patchDraft({ secondaryName: v || undefined })}
          />
          <Field
            label="Relationship"
            value={view.secondaryRelationship ?? ""}
            editing={editing}
            onChange={(v) => patchDraft({ secondaryRelationship: v || undefined })}
          />
          <Field
            label="Phone"
            type="tel"
            value={view.secondaryPhone ?? ""}
            editing={editing}
            onChange={(v) => patchDraft({ secondaryPhone: v || undefined })}
          />
        </Section>
      </div>

      {/* Critical medical info */}
      <Section title="Critical medical information" icon={Heart}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="blood-group" className="inline-flex items-center gap-1.5">
              <Droplet className="size-3.5" /> Blood group
            </Label>
            {editing ? (
              <select
                id="blood-group"
                value={view.bloodGroup}
                onChange={(e) => patchDraft({ bloodGroup: e.target.value as BloodGroup })}
                className="flex h-10 w-full appearance-none rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
              >
                {BLOOD_GROUPS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-semibold">{view.bloodGroup}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="inline-flex items-center gap-1.5">
              <Hospital className="size-3.5" /> Preferred hospital
            </Label>
            {editing ? (
              <Input
                value={view.preferredHospital ?? ""}
                onChange={(e) => patchDraft({ preferredHospital: e.target.value || undefined })}
                placeholder="City General Hospital, Ahmedabad"
              />
            ) : (
              <p className="text-sm">{view.preferredHospital ?? "—"}</p>
            )}
          </div>
        </div>

        <ChipList
          label="Allergies"
          items={view.allergies}
          editing={editing}
          icon={AlertTriangle}
          tone="danger"
          placeholder="e.g., Penicillin"
          onChange={(arr) => patchDraft({ allergies: arr })}
        />
        <ChipList
          label="Critical medications"
          items={view.criticalMedications}
          editing={editing}
          icon={Pill}
          tone="info"
          placeholder="e.g., Atorvastatin 10mg (daily)"
          onChange={(arr) => patchDraft({ criticalMedications: arr })}
        />

        <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
          <div>
            <p className="text-sm font-medium">Registered organ donor</p>
            <p className="text-[11px] text-[var(--color-muted-foreground)]">Shown to transplant teams if applicable.</p>
          </div>
          {editing ? (
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={view.organDonor}
                onChange={(e) => patchDraft({ organDonor: e.target.checked })}
                className="size-4 rounded border-[var(--color-input)] accent-[var(--color-primary)]"
              />
              Yes, I am a registered donor
            </label>
          ) : view.organDonor ? (
            <Badge variant="success" size="sm" dot>Yes</Badge>
          ) : (
            <Badge variant="muted" size="sm">No</Badge>
          )}
        </div>
      </Section>

      {/* Medical IDs */}
      <MedicalIdsBlock
        items={view.medicalIds}
        editing={editing}
        onChange={(arr) => patchDraft({ medicalIds: arr })}
      />

      <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-xs text-[var(--color-muted-foreground)]">
        <span>
          Last updated {new Date(ec.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <div className="flex items-center gap-2">
          <SecurityBadge variant="encrypted" />
          <SecurityBadge variant="audited" />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  muted,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 ${muted ? "opacity-90" : ""}`}>
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4" /> {title}
      </h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  editing,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {editing ? (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <p className="text-sm">{value || "—"}</p>
      )}
    </div>
  );
}

function ChipList({
  label,
  items,
  editing,
  icon: Icon,
  tone,
  placeholder,
  onChange,
}: {
  label: string;
  items: string[];
  editing: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tone: "danger" | "info";
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [draftItem, setDraftItem] = React.useState("");

  function add() {
    const v = draftItem.trim();
    if (!v) return;
    if (items.includes(v)) {
      toast.info("Already added");
      return;
    }
    onChange([...items, v]);
    setDraftItem("");
  }
  function remove(v: string) {
    onChange(items.filter((x) => x !== v));
  }

  const badgeVariant = tone === "danger" ? "danger" : "info";

  return (
    <div className="space-y-2">
      <Label className="inline-flex items-center gap-1.5">
        <Icon className="size-3.5" /> {label}
      </Label>
      {items.length === 0 && !editing ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">None on file.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span
              key={it}
              className="inline-flex items-center gap-1.5"
            >
              <Badge variant={badgeVariant} size="sm">
                {it}
                {editing && (
                  <button
                    onClick={() => remove(it)}
                    aria-label={`Remove ${it}`}
                    className="ml-1 inline-flex size-4 items-center justify-center rounded-full hover:bg-[var(--color-card)]/40"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </Badge>
            </span>
          ))}
        </div>
      )}
      {editing && (
        <div className="flex gap-2">
          <Input
            value={draftItem}
            onChange={(e) => setDraftItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
          />
          <Button size="sm" variant="outline" onClick={add} disabled={!draftItem.trim()}>
            <Plus /> Add
          </Button>
        </div>
      )}
    </div>
  );
}

function MedicalIdsBlock({
  items,
  editing,
  onChange,
}: {
  items: { label: string; value: string }[];
  editing: boolean;
  onChange: (next: { label: string; value: string }[]) => void;
}) {
  const [labelDraft, setLabelDraft] = React.useState("");
  const [valueDraft, setValueDraft] = React.useState("");

  function add() {
    if (!labelDraft.trim() || !valueDraft.trim()) return;
    onChange([...items, { label: labelDraft.trim(), value: valueDraft.trim() }]);
    setLabelDraft("");
    setValueDraft("");
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <Section title="Medical IDs & conditions" icon={ShieldCheck}>
      {items.length === 0 && !editing ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">No medical IDs on file.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{it.label}</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{it.value}</p>
              </div>
              {editing && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[var(--color-danger)]"
                  onClick={() => remove(i)}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
          <Input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            placeholder="Diabetic Type 2"
          />
          <Input
            value={valueDraft}
            onChange={(e) => setValueDraft(e.target.value)}
            placeholder="Diagnosed 2022 · controlled with metformin"
          />
          <Button size="sm" variant="outline" onClick={add} disabled={!labelDraft.trim() || !valueDraft.trim()}>
            <Plus /> Add
          </Button>
        </div>
      )}
    </Section>
  );
}
