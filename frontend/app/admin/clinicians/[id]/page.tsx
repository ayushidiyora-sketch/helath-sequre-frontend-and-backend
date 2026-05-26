"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Stethoscope,
  Building2,
  Award,
  Users,
  User,
  Ban,
  RotateCcw,
  RefreshCw,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ActionButton } from "@/components/shared/action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminStore, fullName } from "@/lib/admin-store";

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4" /> {title}
      </h2>
      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function Info({ label, value, mono, locked, full }: { label: string; value: string; mono?: boolean; locked?: boolean; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2 lg:col-span-3" : ""}>
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
        {locked && <Lock className="size-3" />}
      </p>
      <p className={`mt-0.5 text-sm ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

export default function ClinicianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const {
    state,
    setStaffStatus,
    setStaffLicenseStatus,
    forcePasswordReset,
    reassignClinician,
  } = useAdminStore();
  const [departOpen, setDepartOpen] = useState(false);

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const c = state.staff.find((s) => s.id === id && s.role === "Clinician");
  if (!c) return <NotFound id={id} />;

  const initials = ((c.firstName[0] ?? "") + (c.lastName[0] ?? "")).toUpperCase();
  const activeAssignments = state.assignments.filter((a) => a.clinicianId === c.id && a.status === "active");
  const otherClinicians = state.staff.filter((s) => s.role === "Clinician" && s.id !== c.id && s.status === "active");

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/admin/clinicians" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Clinicians
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">Dr. {fullName(c)}</span>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14 text-base"><AvatarFallback>{initials}</AvatarFallback></Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dr. {fullName(c)}</h1>
                {c.invitationStatus === "pending" && <Badge variant="warning" size="sm" dot>Invited</Badge>}
                {c.status === "active" && c.invitationStatus === "accepted" && <Badge variant="success" size="sm" dot>Active</Badge>}
                {c.status === "deactivated" && <Badge variant="muted" size="sm">Deactivated</Badge>}
                {c.status === "under_investigation" && <Badge variant="danger" size="sm" dot>Under review</Badge>}
                {c.licenseStatus === "pending_verification" && (
                  <Badge variant="warning" size="sm" dot><ShieldAlert /> License pending</Badge>
                )}
                {c.licenseStatus === "verified" && (
                  <Badge variant="success" size="sm" dot><ShieldCheck /> Verified</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {c.specialization ?? "—"} · {c.department ?? "—"}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-[var(--color-muted-foreground)]">{c.licenseNumber}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                forcePasswordReset(c.id);
                toast.warning("Password reset enforced", { description: "All sessions revoked · reset email sent" });
              }}
            >
              <RefreshCw /> Force password reset
            </Button>
            {c.licenseStatus === "pending_verification" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStaffLicenseStatus(c.id, "verified");
                    toast.success("License verified", { description: c.licenseNumber });
                  }}
                >
                  <ShieldCheck /> Verify license
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                  onClick={() => {
                    setStaffLicenseStatus(c.id, "rejected");
                    toast.error("License rejected", { description: c.licenseNumber });
                  }}
                >
                  Reject
                </Button>
              </>
            )}
            {c.status !== "deactivated" ? (
              <Button
                variant="outline"
                size="sm"
                className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                onClick={() => setDepartOpen(true)}
              >
                <Ban /> Deactivate
              </Button>
            ) : (
              <ActionButton
                variant="outline"
                size="sm"
                onClick={() => {
                  setStaffStatus(c.id, "active");
                  toast.success(`${fullName(c)} reactivated`);
                }}
              >
                <RotateCcw /> Reactivate
              </ActionButton>
            )}
          </div>
        </div>
      </div>

      <Section icon={Award} title="Professional credentials">
        <Info label="Medical license number" value={c.licenseNumber ?? "—"} mono />
        <Info label="License status" value={c.licenseStatus ?? "—"} />
        <Info label="Specialization" value={c.specialization ?? "—"} />
        <Info label="Department" value={c.department ?? "—"} />
        <Info label="Email" value={c.email} />
        <Info label="Invitation status" value={c.invitationStatus} />
      </Section>

      <Section icon={Building2} title="Engagement">
        <Info label="Invited" value={new Date(c.invitedAt).toLocaleDateString()} />
        <Info label="Accepted" value={c.acceptedAt ? new Date(c.acceptedAt).toLocaleDateString() : "Pending"} />
        <Info label="Last login" value={c.lastLoginAt ? new Date(c.lastLoginAt).toLocaleString() : "Never"} />
      </Section>

      <Section icon={Users} title="Panel">
        <Info label="Active assignments" value={String(activeAssignments.length)} />
        <Info
          label="Pending consent"
          value={String(state.assignments.filter((a) => a.clinicianId === c.id && a.status === "pending_consent").length)}
        />
        <Info
          label="Transferred"
          value={String(state.assignments.filter((a) => a.clinicianId === c.id && a.status === "transferred").length)}
        />
      </Section>

      <Section icon={User} title="Contact">
        <Info label="Email" value={c.email} />
        <Info label="Phone" value="—" />
        <div className="sm:col-span-2 lg:col-span-3 text-xs text-[var(--color-muted-foreground)]">
          <Stethoscope className="inline size-3.5" /> Quick contact:{" "}
          <Link href={`mailto:${c.email}`} className="text-[var(--color-primary-700)] hover:underline">
            <Mail className="inline size-3" /> {c.email}
          </Link>
        </div>
      </Section>

      <DepartureDialog
        open={departOpen}
        onOpenChange={setDepartOpen}
        clinician={c}
        activeAssignments={activeAssignments}
        otherClinicians={otherClinicians.map((o) => ({ id: o.id, name: `Dr. ${fullName(o)}`, department: o.department ?? "—" }))}
        patientName={(pid) => {
          const p = state.patients.find((x) => x.id === pid);
          return p ? `${p.firstName} ${p.lastName}` : pid;
        }}
        onConfirm={(reassignments) => {
          for (const r of reassignments) {
            if (r.toClinicianId) {
              reassignClinician(r.patientId, c.id, r.toClinicianId);
            }
          }
          setStaffStatus(c.id, "deactivated");
          toast.warning(`Dr. ${fullName(c)} deactivated`, {
            description: `${reassignments.filter((r) => r.toClinicianId).length} patient(s) reassigned · all sessions revoked · audit-logged`,
          });
          setDepartOpen(false);
          router.push("/admin/clinicians");
        }}
      />
    </>
  );
}

function DepartureDialog({
  open,
  onOpenChange,
  clinician,
  activeAssignments,
  otherClinicians,
  patientName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinician: { firstName: string; lastName: string };
  activeAssignments: { id: string; patientId: string }[];
  otherClinicians: { id: string; name: string; department: string }[];
  patientName: (pid: string) => string;
  onConfirm: (reassignments: { patientId: string; toClinicianId: string }[]) => void;
}) {
  const [assignTo, setAssignTo] = useState<Record<string, string>>({});

  function roundRobin() {
    if (otherClinicians.length === 0) return;
    const next: Record<string, string> = {};
    activeAssignments.forEach((a, i) => {
      next[a.patientId] = otherClinicians[i % otherClinicians.length].id;
    });
    setAssignTo(next);
  }

  function submit() {
    const reassignments = activeAssignments.map((a) => ({
      patientId: a.patientId,
      toClinicianId: assignTo[a.patientId] ?? "",
    }));
    onConfirm(reassignments);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Deactivate Dr. {clinician.firstName} {clinician.lastName}?</DialogTitle>
          <DialogDescription>
            Active sessions will be revoked immediately. {activeAssignments.length} active patient assignment(s) — reassign each before continuing. Patients will be notified and must grant fresh consent.
          </DialogDescription>
        </DialogHeader>

        {activeAssignments.length === 0 ? (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-xs text-[var(--color-muted-foreground)]">
            No active assignments — safe to deactivate immediately.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {Object.values(assignTo).filter(Boolean).length} of {activeAssignments.length} reassigned
              </p>
              <Button variant="outline" size="sm" onClick={roundRobin} disabled={otherClinicians.length === 0}>
                Round-robin distribute
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {activeAssignments.map((a) => (
                <div key={a.id} className="grid grid-cols-[1fr_220px] items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                  <div>
                    <p className="text-sm font-medium">{patientName(a.patientId)}</p>
                    <p className="text-[10px] font-mono text-[var(--color-muted-foreground)]">{a.patientId}</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`ra-${a.id}`} className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">Reassign to</Label>
                    <select
                      id={`ra-${a.id}`}
                      value={assignTo[a.patientId] ?? ""}
                      onChange={(e) => setAssignTo((curr) => ({ ...curr, [a.patientId]: e.target.value }))}
                      className="flex h-9 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-2 text-xs focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
                    >
                      <option value="">— Pick clinician —</option>
                      {otherClinicians.map((o) => (
                        <option key={o.id} value={o.id}>{o.name} · {o.department}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            {otherClinicians.length === 0 && (
              <p className="text-[11px] text-[var(--color-danger)]">
                No other active clinicians available. Invite a replacement first.
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={activeAssignments.length > 0 && Object.values(assignTo).filter(Boolean).length < activeAssignments.length}
          >
            <Ban /> Deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotFound({ id }: { id: string }) {
  // Lints don't need the unused Input but the user might extend later.
  void Input;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/admin/clinicians" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Clinicians
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{id}</span>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
        <p className="text-sm font-medium">Clinician not found</p>
        <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
          <code className="font-mono">{id}</code> doesn&apos;t exist or is not a clinician.
        </p>
        <Button asChild size="sm">
          <Link href="/admin/clinicians">Back to clinicians</Link>
        </Button>
      </div>
    </div>
  );
}
