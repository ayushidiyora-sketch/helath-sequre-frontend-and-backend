"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  ShieldCheck,
  KeyRound,
  UserCog,
  RefreshCw,
  Power,
  Check,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { InviteUserDialog } from "@/components/shared/form-dialogs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAdminStore, fullName, type StaffMember, type StaffRole, type ActiveStatus, type InvitationStatus } from "@/lib/admin-store";

const TABS = [
  { key: "all", label: "All" },
  { key: "clinicians", label: "Clinicians" },
  { key: "admins", label: "Admins" },
  { key: "invited", label: "Invited" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type StatusKey = "all" | "active" | "invited" | "deactivated";
const STATUS_FILTERS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "All statuses" },
  { key: "active", label: "Active" },
  { key: "invited", label: "Invited" },
  { key: "deactivated", label: "Deactivated" },
];

function matchesStatus(u: StaffMember, status: StatusKey): boolean {
  if (status === "all") return true;
  if (status === "invited") return u.invitationStatus === "pending";
  if (status === "active") return u.invitationStatus === "accepted" && u.status === "active";
  if (status === "deactivated") return u.status === "deactivated";
  return true;
}

export default function AdminUsersPage() {
  const { state, setStaffStatus, forcePasswordReset, addStaff, markOnboardingStep } = useAdminStore();
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const visible = useMemo(() => {
    return state.staff.filter((u) => {
      if (tab === "clinicians" && u.role !== "Clinician") return false;
      if (tab === "admins" && u.role !== "Org Admin") return false;
      if (tab === "invited" && u.invitationStatus !== "pending") return false;
      if (!matchesStatus(u, statusFilter)) return false;
      const q = search.trim().toLowerCase();
      if (q && !`${fullName(u)} ${u.email} ${u.role} ${u.department ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [state.staff, tab, statusFilter, search]);

  const counts = {
    total: state.staff.length,
    active: state.staff.filter((u) => u.invitationStatus === "accepted" && u.status === "active").length,
    invited: state.staff.filter((u) => u.invitationStatus === "pending").length,
    deactivated: state.staff.filter((u) => u.status === "deactivated").length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title="User management"
        description="Provision users via invitation tokens. Deactivation preserves the audit trail; you cannot delete users."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={statusFilter !== "all" ? "soft" : "outline"} size="sm">
                  <Filter /> Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_FILTERS.map((s) => (
                  <DropdownMenuItem key={s.key} onSelect={() => setStatusFilter(s.key)}>
                    <Check className={statusFilter === s.key ? "" : "opacity-0"} />
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/users/bulk"><Upload /> Bulk CSV</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/users/invite">Add full profile</Link>
            </Button>
            <InviteUserDialog
              defaultRole="Care Team"
              triggerLabel={<><Plus /> Invite staff</>}
              triggerProps={{ size: "sm" }}
              onCreated={({ firstName, lastName, email, role, department }) => {
                addStaff({ firstName, lastName, email, role: role as StaffRole, department });
                if (role === "Compliance Manager") markOnboardingStep("complianceManagerInvited", true);
                else markOnboardingStep("firstStaffInvited", true);
              }}
            />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total" value={counts.total} />
        <Stat label="Active" value={counts.active} accent="success" />
        <Stat label="Invited" value={counts.invited} accent="warning" />
        <Stat label="Deactivated" value={counts.deactivated} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                  : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search by name, email, role…"
          leadingIcon={<Search />}
          className="w-full max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="grid grid-cols-12 gap-4 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <div className="col-span-4">User</div>
          <div className="col-span-3">Role</div>
          <div className="col-span-2">Department</div>
          <div className="col-span-1">MFA</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
            {state.staff.length === 0 ? "No staff yet. Invite your first staff member." : "No users match the current filters."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {visible.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onForceReset={() => {
                  forcePasswordReset(u.id);
                  toast.warning("Password reset enforced", { description: `${fullName(u)} · all sessions revoked · email sent` });
                }}
                onDeactivate={() => {
                  setStaffStatus(u.id, "deactivated");
                  toast.warning("User deactivated", { description: `${fullName(u)} · audit trail preserved` });
                }}
                onReactivate={() => {
                  setStaffStatus(u.id, "active");
                  toast.success("User reactivated");
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "success" | "warning" }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${
        accent === "success" ? "text-[var(--color-success)]" :
        accent === "warning" ? "text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]" : ""
      }`}>{value}</p>
    </div>
  );
}

function UserRow({ user, onForceReset, onDeactivate, onReactivate }: {
  user: StaffMember;
  onForceReset: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const initials = ((user.firstName[0] ?? "") + (user.lastName[0] ?? "")).toUpperCase();
  return (
    <li className="grid grid-cols-12 items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-muted)]/40">
      <div className="col-span-4 flex items-center gap-3 min-w-0">
        <Avatar className="size-9"><AvatarFallback>{initials}</AvatarFallback></Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{fullName(user)}</p>
          <p className="truncate text-[11px] text-[var(--color-muted-foreground)]">{user.email}</p>
        </div>
      </div>
      <div className="col-span-3 text-sm">{user.role}</div>
      <div className="col-span-2 text-xs text-[var(--color-muted-foreground)]">{user.department ?? "—"}</div>
      <div className="col-span-1">
        {user.invitationStatus === "accepted" ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-success)]"><ShieldCheck className="size-3.5" /> On</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted-foreground)]"><KeyRound className="size-3.5" /> —</span>
        )}
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2">
        <StatusBadge invitation={user.invitationStatus} status={user.status} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${fullName(user)}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="truncate">{fullName(user)}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={user.role === "Clinician" ? `/admin/clinicians/${user.id}` : "#"}>
                <UserCog /> View profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onForceReset}>
              <RefreshCw /> Force password reset
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {user.status === "deactivated" ? (
              <DropdownMenuItem onSelect={onReactivate}>
                <Power /> Reactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-[var(--color-danger)] focus:bg-[var(--color-danger-soft)] focus:text-[var(--color-danger)]"
                onSelect={onDeactivate}
              >
                <Power /> Deactivate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function StatusBadge({ invitation, status }: { invitation: InvitationStatus; status: ActiveStatus }) {
  if (status === "deactivated") return <Badge variant="muted" size="sm">Deactivated</Badge>;
  if (status === "under_investigation") return <Badge variant="danger" size="sm" dot>Under review</Badge>;
  if (invitation === "pending") return <Badge variant="warning" size="sm" dot>Invited</Badge>;
  if (invitation === "expired") return <Badge variant="muted" size="sm">Expired</Badge>;
  if (invitation === "bounced") return <Badge variant="danger" size="sm" dot>Bounced</Badge>;
  return <Badge variant="success" size="sm" dot>Active</Badge>;
}
