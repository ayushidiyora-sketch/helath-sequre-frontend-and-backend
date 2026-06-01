"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Loader2,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface Staff {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  status: "active" | "invited" | "suspended" | "deactivated";
  invitation: "pending" | "accepted";
  profilePhotoUrl: string | null;
  createdAt: string;
}

const PAGE_SIZE = 10;

/** Prefix every clinical/staff name with "Dr." for display. */
function displayName(u: { firstName: string; lastName: string }): string {
  return `Dr. ${u.firstName} ${u.lastName}`.trim();
}

const TABS = [
  { key: "all", label: "All" },
  { key: "clinicians", label: "Clinicians" },
  { key: "compliance", label: "Compliance Managers" },
  { key: "auditors", label: "Auditors" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type StatusKey = "all" | "active" | "invited" | "deactivated";
const STATUS_FILTERS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "All statuses" },
  { key: "active", label: "Active" },
  { key: "invited", label: "Invited" },
  { key: "deactivated", label: "Deactivated" },
];

const ROLE_OPTIONS = ["Clinician", "Compliance Manager", "Auditor"] as const;

const SELECT_CLASS =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

// Unprefixed name kept for search matching so "Patience" still finds the row.
function fullName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`.trim();
}

function matchesStatus(u: Staff, filter: StatusKey): boolean {
  if (filter === "all") return true;
  if (filter === "invited") return u.status === "invited";
  if (filter === "active") return u.status === "active";
  if (filter === "deactivated") return u.status === "deactivated";
  return true;
}

export default function AdminUsersPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the visible set changes — otherwise the user
  // could be stuck on a page that no longer exists after a filter change.
  useEffect(() => {
    setPage(1);
  }, [tab, search, statusFilter]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) setStaff(data.staff);
    } catch {
      /* keep last successful list */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const visible = useMemo(() => {
    return staff.filter((u) => {
      if (tab === "clinicians" && u.role !== "Clinician") return false;
      if (tab === "compliance" && u.role !== "Compliance Manager") return false;
      if (tab === "auditors" && u.role !== "Auditor") return false;
      if (!matchesStatus(u, statusFilter)) return false;
      const q = search.trim().toLowerCase();
      if (q && !`${fullName(u)} ${u.email} ${u.role}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [staff, tab, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paged = visible.slice(pageStart, pageStart + PAGE_SIZE);

  const counts = {
    total: staff.length,
    active: staff.filter((u) => u.status === "active").length,
    invited: staff.filter((u) => u.status === "invited").length,
    deactivated: staff.filter((u) => u.status === "deactivated").length,
  };

  async function patchStaff(id: string, body: Record<string, unknown>, msg: { ok: string; fail: string }) {
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        toast.error(msg.fail, { description: data.error ?? `HTTP ${r.status}` });
        return;
      }
      toast.success(msg.ok);
      await refresh();
    } catch {
      toast.error(msg.fail, { description: "Network error" });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title="User management"
        description="Invite users by email. Each invite mints a single-use onboarding link and a temporary password the user replaces on first sign-in. Deactivation preserves the audit trail; you cannot delete users."
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
              <Link href="/admin/users/bulk">
                <Upload /> Bulk CSV
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/users/invite">
                <UserCog /> Add full profile
              </Link>
            </Button>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <Plus /> Invite staff
            </Button>
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
          <div className="col-span-2">Joined</div>
          <div className="col-span-1">MFA</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 className="size-4 animate-spin" /> Loading staff…
          </div>
        ) : visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
            {staff.length === 0
              ? "No staff yet. Invite your first staff member."
              : "No users match the current filters."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {paged.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onForceReset={() =>
                  patchStaff(
                    u.id,
                    { forcePasswordReset: true },
                    { ok: `Reset enforced for ${displayName(u)}`, fail: "Could not enforce reset" },
                  )
                }
                onDeactivate={() =>
                  patchStaff(
                    u.id,
                    { status: "deactivated" },
                    { ok: `${displayName(u)} deactivated`, fail: "Could not deactivate" },
                  )
                }
                onReactivate={() =>
                  patchStaff(
                    u.id,
                    { status: "active" },
                    { ok: `${displayName(u)} reactivated`, fail: "Could not reactivate" },
                  )
                }
              />
            ))}
          </ul>
        )}
        {!loading && visible.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-muted)]/30 px-5 py-3 text-xs">
            <span className="text-[var(--color-muted-foreground)]">
              Showing{" "}
              <span className="font-medium text-[var(--color-foreground)]">
                {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, visible.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-[var(--color-foreground)]">{visible.length}</span>
            </span>
            <div className="inline-flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft />
              </Button>
              <span className="px-2 tabular-nums text-[var(--color-muted-foreground)]">
                Page <span className="font-medium text-[var(--color-foreground)]">{currentPage}</span>{" "}
                of <span className="font-medium text-[var(--color-foreground)]">{totalPages}</span>
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </div>

      <InviteStaffDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={async () => {
          await refresh();
        }}
      />
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "success" | "warning" }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          accent === "success"
            ? "text-[var(--color-success)]"
            : accent === "warning"
              ? "text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function UserRow({
  user,
  onForceReset,
  onDeactivate,
  onReactivate,
}: {
  user: Staff;
  onForceReset: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const initials = ((user.firstName[0] ?? "") + (user.lastName[0] ?? "")).toUpperCase();
  const joined = new Date(user.createdAt).toLocaleDateString();
  const photo = user.profilePhotoUrl && /^(data:|https?:)/i.test(user.profilePhotoUrl) ? user.profilePhotoUrl : null;
  return (
    <li className="grid grid-cols-12 items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-muted)]/40">
      <div className="col-span-4 flex items-center gap-3 min-w-0">
        <Avatar className="size-9">
          {photo && <AvatarImage src={photo} alt={fullName(user)} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName(user)}</p>
          <p className="truncate text-[11px] text-[var(--color-muted-foreground)]">{user.email}</p>
        </div>
      </div>
      <div className="col-span-3 text-sm">{user.role}</div>
      <div className="col-span-2 text-xs text-[var(--color-muted-foreground)]">{joined}</div>
      <div className="col-span-1">
        {user.status === "active" ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-success)]">
            <ShieldCheck className="size-3.5" /> On
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted-foreground)]">
            <KeyRound className="size-3.5" /> —
          </span>
        )}
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2">
        <StatusBadge status={user.status} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${fullName(user)}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="truncate">{displayName(user)}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/admin/users/${user.slug}`}>
                <UserCog /> View profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/users/${user.slug}/edit`}>
                <Pencil /> Edit profile
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

function StatusBadge({ status }: { status: Staff["status"] }) {
  if (status === "deactivated") return <Badge variant="muted" size="sm">Deactivated</Badge>;
  if (status === "suspended")
    return (
      <Badge variant="danger" size="sm" dot>
        Suspended
      </Badge>
    );
  if (status === "invited")
    return (
      <Badge variant="warning" size="sm" dot>
        Invited
      </Badge>
    );
  return (
    <Badge variant="success" size="sm" dot>
      Active
    </Badge>
  );
}

function InviteStaffDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => Promise<void> | void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("Clinician");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setRole("Clinician");
      setSubmitting(false);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, phone, role }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        toast.error("Could not invite", { description: data.error ?? `HTTP ${r.status}` });
        setSubmitting(false);
        return;
      }
      if (data.mailSent) {
        toast.success(`Invited ${firstName} ${lastName}`, {
          description: `Welcome email sent via ${data.mailVia} to ${email} · audit-logged`,
        });
      } else {
        const pw = data.devCredentials?.password as string | undefined;
        toast.warning(`Invited ${firstName} ${lastName} — email NOT delivered`, {
          description: `${data.mailError ?? "Mail transport failed"}${
            pw ? `\n\nTemp password (share out-of-band): ${pw}` : ""
          }`,
          duration: 20000,
        });
      }
      await onCreated();
      onOpenChange(false);
    } catch {
      toast.error("Could not invite", { description: "Network error" });
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Invite staff member</DialogTitle>
          <DialogDescription>
            We&apos;ll create their account, mint a single-use onboarding link, and email them
            sign-in credentials. They&apos;ll be asked to change the password on first sign-in.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4 pt-2" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-first">First name</Label>
              <Input
                id="inv-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-last">Last name</Label>
              <Input
                id="inv-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              type="email"
              placeholder="staff@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-role">Role</Label>
              <select
                id="inv-role"
                className={SELECT_CLASS}
                value={role}
                onChange={(e) => setRole(e.target.value as (typeof ROLE_OPTIONS)[number])}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-phone">Phone (optional)</Label>
              <Input
                id="inv-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 …"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> Sending invite…
                </>
              ) : (
                <>
                  <Plus /> Send invite
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
