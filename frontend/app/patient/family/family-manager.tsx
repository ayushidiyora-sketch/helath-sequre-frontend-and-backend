"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Baby,
  Heart,
  Phone,
  Mail,
  Pencil,
  Trash2,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  type FamilyMember,
  type FamilyRelationship,
} from "@/lib/patient-store";

const RELATIONSHIPS: FamilyRelationship[] = ["Spouse", "Child", "Parent", "Sibling", "Guardian", "Other"];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "??";
}

function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function dateOnlyToLabel(dob: string): string {
  if (!dob) return "—";
  return new Date(dob).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function FamilyManager() {
  const { state, addFamilyMember, updateFamilyMember, removeFamilyMember } = usePatientStore();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FamilyMember | null>(null);

  if (!state.hydrated) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading…
      </div>
    );
  }

  const family = state.family;
  const minors = family.filter((m) => m.isMinor).length;
  const caregivers = family.filter((m) => m.canManageAccount).length;
  const lastAdded = family
    .map((m) => m.addedAt)
    .sort((a, b) => b.localeCompare(a))[0];

  function openAdd() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(member: FamilyMember) {
    setEditing(member);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openAdd}>
          <UserPlus /> Add family member
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={Users} label="Total members" value={family.length} />
        <Stat icon={Baby} label="Minors" value={minors} tone="warning" />
        <Stat icon={Heart} label="Caregivers" value={caregivers} tone="info" />
        <Stat
          icon={Calendar}
          label="Last added"
          value={lastAdded ? new Date(lastAdded).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
        />
      </div>

      {family.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
          <Users className="size-6 text-[var(--color-muted-foreground)]" />
          <p className="text-sm font-medium">No family members added yet</p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            Add a spouse, child, parent, or any caregiver who needs to act on your behalf.
          </p>
          <Button size="sm" onClick={openAdd}><UserPlus /> Add your first member</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              {family.length} member{family.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <SecurityBadge variant="encrypted" />
              <SecurityBadge variant="audited" />
            </div>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {family.map((m) => {
              const age = ageFromDob(m.dob);
              return (
                <li key={m.id} className="flex flex-wrap items-start gap-4 p-5 hover:bg-[var(--color-muted)]/30">
                  <Avatar className="size-12"><AvatarFallback>{initials(m.name)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <Badge variant="muted" size="sm">{m.relationship}</Badge>
                      {m.isMinor && <Badge variant="warning" size="sm" dot>Minor</Badge>}
                      {m.canManageAccount && <Badge variant="success" size="sm" dot>Caregiver</Badge>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">
                      DOB {dateOnlyToLabel(m.dob)} {age != null ? `· age ${age}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--color-muted-foreground)]">
                      {m.phone && (
                        <span className="inline-flex items-center gap-1"><Phone className="size-3" /> {m.phone}</span>
                      )}
                      {m.email && (
                        <span className="inline-flex items-center gap-1"><Mail className="size-3" /> {m.email}</span>
                      )}
                    </div>
                    {m.notes && (
                      <p className="mt-2 text-[11px] italic text-[var(--color-muted-foreground)]">{m.notes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                      <Pencil /> Edit
                    </Button>
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                      confirm={{
                        title: `Remove ${m.name}?`,
                        description: "They will no longer be listed as a dependent or caregiver. This action is audit-logged.",
                        confirmLabel: "Remove",
                        variant: "destructive",
                      }}
                      toastMessage="Family member removed"
                      toastDescription={`${m.name} · audit-logged`}
                      onClick={() => removeFamilyMember(m.id)}
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

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-xs text-[var(--color-muted-foreground)]">
        <ShieldCheck className="mr-1 inline size-3.5 text-[var(--color-primary-700)]" />
        Caregivers can manage appointments and view records of dependents you assign to them. Edit permissions per
        member from this screen. Every change is audit-logged.
      </div>

      <FamilyDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSubmit={(values) => {
          if (editing) {
            updateFamilyMember(editing.id, values);
            toast.success("Family member updated", { description: `${values.name} · audit-logged` });
          } else {
            addFamilyMember(values);
            toast.success("Family member added", { description: `${values.name} · audit-logged` });
          }
          setOpen(false);
        }}
      />
    </div>
  );
}

interface FormValues {
  name: string;
  relationship: FamilyRelationship;
  dob: string;
  isMinor: boolean;
  canManageAccount: boolean;
  phone?: string;
  email?: string;
  notes?: string;
}

function FamilyDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: FamilyMember | null;
  onSubmit: (values: FormValues) => void;
}) {
  const [name, setName] = React.useState("");
  const [relationship, setRelationship] = React.useState<FamilyRelationship>("Spouse");
  const [dob, setDob] = React.useState("");
  const [isMinor, setIsMinor] = React.useState(false);
  const [canManage, setCanManage] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setRelationship(editing.relationship);
      setDob(editing.dob);
      setIsMinor(editing.isMinor);
      setCanManage(editing.canManageAccount);
      setPhone(editing.phone ?? "");
      setEmail(editing.email ?? "");
      setNotes(editing.notes ?? "");
    } else {
      setName("");
      setRelationship("Spouse");
      setDob("");
      setIsMinor(false);
      setCanManage(false);
      setPhone("");
      setEmail("");
      setNotes("");
    }
  }, [open, editing]);

  const valid = name.trim().length > 0 && dob.length > 0;

  function submit() {
    if (!valid) return;
    onSubmit({
      name: name.trim(),
      relationship,
      dob,
      isMinor,
      canManageAccount: canManage,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit family member" : "Add a family member"}</DialogTitle>
          <DialogDescription>
            They&apos;ll appear in your family list and during emergencies if marked as a contact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fam-name">Full name</Label>
              <Input id="fam-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aanya Sharma" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fam-rel">Relationship</Label>
              <select
                id="fam-rel"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as FamilyRelationship)}
                className="flex h-10 w-full appearance-none rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fam-dob">Date of birth</Label>
              <Input id="fam-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fam-phone">Phone</Label>
              <Input id="fam-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98201 11111" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fam-email">Email</Label>
            <Input id="fam-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>

          <div className="grid gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-sm">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isMinor}
                onChange={(e) => setIsMinor(e.target.checked)}
                className="mt-0.5 size-4 rounded border-[var(--color-input)] accent-[var(--color-primary)]"
              />
              <span>
                <span className="font-medium">Minor (under 18)</span>
                <span className="block text-[11px] text-[var(--color-muted-foreground)]">A guardian must manage their account.</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={canManage}
                onChange={(e) => setCanManage(e.target.checked)}
                className="mt-0.5 size-4 rounded border-[var(--color-input)] accent-[var(--color-primary)]"
              />
              <span>
                <span className="font-medium">Authorised caregiver</span>
                <span className="block text-[11px] text-[var(--color-muted-foreground)]">Can manage appointments and view your records on your behalf.</span>
              </span>
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fam-notes">Notes (optional)</Label>
            <Textarea
              id="fam-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pediatrician name, school nurse contact, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid}>
            {editing ? "Save changes" : "Add member"}
          </Button>
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
