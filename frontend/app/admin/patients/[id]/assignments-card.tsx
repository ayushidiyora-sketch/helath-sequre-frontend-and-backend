"use client";

import { useState } from "react";
import { Plus, ShieldCheck, ShieldAlert, X, UserPlus2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminStore, fullName, type Assignment, type StaffMember } from "@/lib/admin-store";

export function AssignmentsCard({ patientId }: { patientId: string }) {
  const { state, createAssignment, markAssignmentConsented, revokeAssignment } = useAdminStore();
  const [addOpen, setAddOpen] = useState(false);

  if (!state.hydrated) return null;

  const assignments = state.assignments.filter((a) => a.patientId === patientId);
  const active = assignments.filter((a) => a.status === "active");
  const pending = assignments.filter((a) => a.status === "pending_consent");
  const past = assignments.filter((a) => a.status === "revoked" || a.status === "transferred");

  const clinicians = state.staff.filter((s) => s.role === "Clinician" && s.status === "active");
  const alreadyAssignedIds = new Set(assignments.filter((a) => a.status !== "revoked" && a.status !== "transferred").map((a) => a.clinicianId));
  const availableClinicians = clinicians.filter((c) => !alreadyAssignedIds.has(c.id));

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <UserPlus2 className="size-4" /> Clinician assignments
        </h2>
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={availableClinicians.length === 0}>
          <Plus /> Assign clinician
        </Button>
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        Newly assigned clinicians cannot view records until the patient grants consent. Patient sees a consent request in their portal.
      </p>

      <div className="mt-4 space-y-4">
        {pending.length > 0 && (
          <AssignmentGroup
            title="Pending patient consent"
            badge={<Badge variant="warning" size="sm" dot>{pending.length}</Badge>}
            assignments={pending}
            getClinician={(id) => clinicians.find((c) => c.id === id)}
            actions={(a) => (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    markAssignmentConsented(a.id);
                    toast.success("Marked consented (demo simulate)", { description: "In production this fires when the patient accepts." });
                  }}
                >
                  <ShieldCheck /> Simulate consent
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                  onClick={() => revokeAssignment(a.id)}
                >
                  <X />
                </Button>
              </>
            )}
          />
        )}
        {active.length > 0 && (
          <AssignmentGroup
            title="Active"
            badge={<Badge variant="success" size="sm" dot>{active.length}</Badge>}
            assignments={active}
            getClinician={(id) => clinicians.find((c) => c.id === id)}
            actions={(a) => (
              <Button
                variant="ghost"
                size="sm"
                className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                onClick={() => {
                  revokeAssignment(a.id);
                  toast.warning("Assignment revoked", { description: "Clinician loses access on next API call" });
                }}
              >
                Revoke
              </Button>
            )}
          />
        )}
        {past.length > 0 && (
          <AssignmentGroup
            title="History"
            badge={<Badge variant="muted" size="sm">{past.length}</Badge>}
            assignments={past}
            getClinician={(id) => clinicians.find((c) => c.id === id)}
            actions={() => null}
            muted
          />
        )}
        {assignments.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4 text-center text-xs text-[var(--color-muted-foreground)]">
            No clinicians assigned. Assigning a clinician triggers a consent request to the patient.
          </p>
        )}
      </div>

      <AssignDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        availableClinicians={availableClinicians}
        onAssign={(clinicianId, reason) => {
          createAssignment(patientId, clinicianId, reason || undefined);
          toast.success("Assignment created", { description: "Patient will be prompted to grant consent on next login" });
          setAddOpen(false);
        }}
      />
    </div>
  );
}

function AssignmentGroup({
  title,
  badge,
  assignments,
  getClinician,
  actions,
  muted,
}: {
  title: string;
  badge: React.ReactNode;
  assignments: Assignment[];
  getClinician: (id: string) => StaffMember | undefined;
  actions: (a: Assignment) => React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={muted ? "opacity-70" : ""}>
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">{title}</p>
        {badge}
      </div>
      <ul className="space-y-2">
        {assignments.map((a) => {
          const c = getClinician(a.clinicianId);
          return (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c ? `Dr. ${fullName(c)}` : a.clinicianId}</p>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">
                  {c?.department ?? "—"} · created {new Date(a.createdAt).toLocaleDateString()}
                  {a.consentedAt && ` · consented ${new Date(a.consentedAt).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2">{actions(a)}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  availableClinicians,
  onAssign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableClinicians: StaffMember[];
  onAssign: (clinicianId: string, reason: string) => void;
}) {
  const [clinicianId, setClinicianId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!clinicianId) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 200));
    onAssign(clinicianId, reason);
    setClinicianId("");
    setReason("");
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign clinician</DialogTitle>
          <DialogDescription>
            Patient will be prompted to grant consent on their next sign-in. The clinician cannot view records until consent is granted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="asg-clin">Clinician</Label>
            <select
              id="asg-clin"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
            >
              <option value="">— Select clinician —</option>
              {availableClinicians.map((c) => (
                <option key={c.id} value={c.id}>
                  Dr. {fullName(c)} · {c.department ?? "—"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asg-reason">Reason (optional)</Label>
            <Textarea
              id="asg-reason"
              placeholder="Continuity of care, specialist referral, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-sm text-[oklch(0.4_0.14_75)] dark:text-[oklch(0.85_0.13_80)]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Assignment creates a <em>pending consent</em> record. Clinician will <strong>not</strong> see records until patient grants consent.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={!clinicianId || submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Plus />} Create assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
