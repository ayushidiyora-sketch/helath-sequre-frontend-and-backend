"use client";

import Link from "next/link";
import { Users, Calendar, ChevronRight, Plus, Stethoscope, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { InviteUserDialog } from "@/components/shared/form-dialogs";
import { useAdminStore, fullName, type StaffMember } from "@/lib/admin-store";



export default function AdminCliniciansPage() {
  const { state, addStaff } = useAdminStore();

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const clinicians = state.staff.filter((s) => s.role === "Clinician");
  const panelOf = (id: string) =>
    state.assignments.filter((a) => a.clinicianId === id && a.status === "active").length;

  return (
    <>
      <PageHeader
        eyebrow="Clinicians"
        title="Clinical team"
        description="Manage clinician panels, slot templates, and department assignments."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/clinicians/invite">Add full profile</Link>
            </Button>
            <InviteUserDialog
              defaultRole="Clinician"
              triggerLabel={<><Plus /> Invite clinician</>}
              triggerProps={{ size: "sm" }}
              onCreated={({ firstName, lastName, email, role, department }) => {
                if (role !== "Clinician") return;
                addStaff({ firstName, lastName, email, role, department });
              }}
            />
          </>
        }
      />

      {clinicians.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center">
          <Stethoscope className="size-7 text-[var(--color-primary-700)]" />
          <p className="text-sm font-semibold">No clinicians yet</p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            Invite your first clinical staff member to start building the panel.
          </p>
          <InviteUserDialog
            defaultRole="Clinician"
            triggerLabel={<><Plus /> Invite clinician</>}
            triggerProps={{ size: "sm", className: "mt-1" }}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {clinicians.map((c) => (
            <ClinicianCard key={c.id} clinician={c} panelSize={panelOf(c.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function ClinicianCard({ clinician, panelSize }: { clinician: StaffMember; panelSize: number }) {
  const initials = ((clinician.firstName[0] ?? "") + (clinician.lastName[0] ?? "")).toUpperCase();
  const utilization = Math.min(100, Math.round((panelSize / 50) * 100)); // assume target panel 50
  return (
    <Link
      href={`/admin/clinicians/${clinician.id}`}
      className="group overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-start gap-4 border-b border-[var(--color-border)] p-5">
        <Avatar className="size-12"><AvatarFallback>{initials}</AvatarFallback></Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Dr. {fullName(clinician)}</p>
            {clinician.invitationStatus === "pending" && <Badge variant="warning" size="sm" dot>Invited</Badge>}
            {clinician.status === "deactivated" && <Badge variant="muted" size="sm">Deactivated</Badge>}
            {clinician.licenseStatus === "pending_verification" && (
              <Badge variant="warning" size="sm" dot><ShieldAlert /> License pending</Badge>
            )}
            {clinician.licenseStatus === "verified" && (
              <Badge variant="success" size="sm" dot><ShieldCheck /> Verified</Badge>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {clinician.specialization ?? "—"} {clinician.department ? `· ${clinician.department}` : ""}
          </p>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">{clinician.email}</p>
        </div>
        <ChevronRight className="size-4 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="grid grid-cols-3 divide-x divide-[var(--color-border)]">
        <div className="p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Panel</p>
          <p className="mt-1 text-lg font-semibold inline-flex items-center gap-1.5">
            <Users className="size-4 text-[var(--color-muted-foreground)]" />{panelSize}
          </p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Status</p>
          <p className="mt-1 text-xs inline-flex items-center gap-1.5">
            <Calendar className="size-3.5 text-[var(--color-muted-foreground)]" />
            {clinician.lastLoginAt ? "Active" : "Never logged in"}
          </p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Utilization</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-lg font-semibold tabular-nums">{utilization}%</p>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--color-muted)]">
              <div
                className={`h-full rounded-full ${utilization > 85 ? "bg-[var(--color-warning)]" : "bg-[var(--color-success)]"}`}
                style={{ width: `${utilization}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
