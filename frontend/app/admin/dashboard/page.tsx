"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus2,
  Stethoscope,
  TrendingUp,
  ArrowRight,
  Plus,
  Building2,
  AlertCircle,
  CheckCircle2,
  Circle,
  HardDrive,
  Bell,
  Mail,
  Calendar,
  Sparkles,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { InviteUserDialog, InvitePatientDialog } from "@/components/shared/form-dialogs";
import { ReportsWidget } from "@/components/shared/reports-widget";
import {
  useAdminStore,
  fullName,
  onboardingProgress,
  type OnboardingChecklist,
  type AdminNotification,
  type AuditEvent,
} from "@/lib/admin-store";

function relativeTime(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

interface TenantInfo {
  name: string;
  tier: string;
  type: string;
  region: string;
  multiAz: boolean;
  status: string;
}
interface TenantCounts {
  totalUsers: number;
  staff: number;
  clinicians: number;
  patients: number;
  pendingInvites: number;
}

export default function AdminDashboard() {
  const { state } = useAdminStore();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [counts, setCounts] = useState<TenantCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/tenant", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; tenant?: TenantInfo; counts?: TenantCounts } | null) => {
        if (cancelled || !data?.ok) return;
        setTenant(data.tenant ?? null);
        setCounts(data.counts ?? null);
      })
      .catch(() => {
        /* fall back to local-store values */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const progress = onboardingProgress(state.onboarding);
  const showWizard = !progress.complete;

  return (
    <>
      <Hero
        orgName={tenant?.name ?? state.orgProfile.name}
        tier={tenant?.tier ?? "Enterprise"}
        multiAz={tenant?.multiAz ?? true}
        patientCount={counts?.patients ?? state.patients.length}
        staffPending={counts?.pendingInvites ?? state.staff.filter((s) => s.invitationStatus === "pending").length}
      />
      {showWizard && <OnboardingWizard checklist={state.onboarding} />}
      <Stats
        patients={state.patients.length}
        staff={state.staff.length}
        clinicians={state.staff.filter((s) => s.role === "Clinician").length}
        departments={state.departments.length}
        pendingInvites={state.staff.filter((s) => s.invitationStatus === "pending").length + state.patients.filter((p) => p.invitationStatus === "pending").length}
      />
      <ReportsWidget preset="admin" />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <RecentActivity audit={state.audit.slice(0, 8)} />
        </div>
        <div className="space-y-5">
          <PendingInvitations
            pendingStaff={state.staff.filter((s) => s.invitationStatus === "pending")}
            pendingPatients={state.patients.filter((p) => p.invitationStatus === "pending")}
          />
          <NotificationsCard notifications={state.notifications.filter((n) => !n.read).slice(0, 3)} />
          <QuickActions />
        </div>
      </div>
    </>
  );
}

function Hero({
  orgName,
  tier,
  multiAz,
  patientCount,
  staffPending,
}: {
  orgName: string;
  tier: string;
  multiAz: boolean;
  patientCount: number;
  staffPending: number;
}) {
  const tierBlurb =
    tier === "Enterprise"
      ? `${multiAz ? "Multi-AZ · " : ""}SMS enabled · 99.9% SLA`
      : tier === "Pro"
        ? `${multiAz ? "Multi-AZ · " : ""}SMS enabled · 99.5% SLA`
        : `${multiAz ? "Multi-AZ · " : ""}Email only · 99% SLA`;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[oklch(0.96_0.025_320)] p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gradient-to-br from-[oklch(0.75_0.15_320)] to-transparent opacity-25 blur-3xl" />
      <div className="relative grid gap-5 sm:grid-cols-[1.4fr_1fr] sm:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
            {orgName}{patientCount > 0 ? ` · ${patientCount.toLocaleString()} patient${patientCount === 1 ? "" : "s"}` : ""}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Operations overview
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-[var(--color-muted-foreground)]">
            {staffPending > 0
              ? `${staffPending} staff invitation${staffPending === 1 ? "" : "s"} pending acceptance.`
              : patientCount === 0
                ? "Your tenant is set up — invite staff and patients to get started."
                : "Everyone is onboarded."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <InviteUserDialog
              triggerLabel={<><Plus /> Invite staff</>}
              triggerProps={{ size: "sm" }}
            />
            <InvitePatientDialog
              triggerLabel={<><UserPlus2 /> Invite patient</>}
              triggerProps={{ size: "sm", variant: "outline" }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Subscription tier</p>
          <p className="mt-1 text-lg font-semibold">{tier}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">{tierBlurb}</p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 text-[var(--color-muted-foreground)]"><HardDrive className="size-3.5" /> Storage 0 GB / 2 TB</span>
            <Link href="/admin/settings" className="font-medium text-[var(--color-primary-700)] hover:underline">Manage →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingWizard({ checklist }: { checklist: OnboardingChecklist }) {
  const steps: { key: keyof OnboardingChecklist; label: string; href: string }[] = [
    { key: "orgProfileComplete", label: "Set up organization profile", href: "/admin/settings" },
    { key: "departmentsCreated", label: "Create departments", href: "/admin/departments" },
    { key: "complianceManagerInvited", label: "Invite Compliance Manager", href: "/admin/users" },
    { key: "firstStaffInvited", label: "Invite first clinical staff", href: "/admin/users" },
    { key: "firstPatientInvited", label: "Invite first patient", href: "/admin/patients" },
    { key: "templatesConfigured", label: "Customize notification templates", href: "/admin/templates" },
    { key: "schedulePolicySet", label: "Set schedule policies", href: "/admin/appointments" },
  ];
  const progress = onboardingProgress(checklist);

  return (
    <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-50)]/30 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-card)] text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary)]/20">
          <Sparkles className="size-5" />
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Welcome — finish setting up your hospital</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {progress.done} of {progress.total} steps complete
              </p>
            </div>
            <Badge variant="info" size="sm">{Math.round((progress.done / progress.total) * 100)}%</Badge>
          </div>
          <Progress value={Math.round((progress.done / progress.total) * 100)} className="mt-3" />
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {steps.map((s) => {
              const done = checklist[s.key];
              return (
                <li key={s.key}>
                  <Link
                    href={s.href}
                    className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-xs transition-colors ${
                      done
                        ? "border-[var(--color-success)]/30 bg-[var(--color-card)] text-[var(--color-muted-foreground)]"
                        : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)]"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-[var(--color-success)]" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-[var(--color-muted-foreground)]" />
                    )}
                    <span className={done ? "line-through" : "font-medium"}>{s.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stats({ patients, staff, clinicians, departments, pendingInvites }: { patients: number; staff: number; clinicians: number; departments: number; pendingInvites: number }) {
  const stats = [
    { label: "Total patients", value: patients.toLocaleString(), sub: patients === 0 ? "none yet" : "registered", icon: UserPlus2, accent: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]" },
    { label: "Staff users", value: staff, sub: pendingInvites > 0 ? `${pendingInvites} pending` : "all accepted", icon: Users, accent: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]" },
    { label: "Active clinicians", value: clinicians, sub: clinicians === 0 ? "invite to get started" : "across departments", icon: Stethoscope, accent: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]" },
    { label: "Departments", value: departments, sub: departments === 0 ? "create hierarchy" : "configured", icon: Building2, accent: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{s.label}</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{s.sub}</p>
              </div>
              <span className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.accent} text-white shadow-[var(--shadow-soft)]`}>
                <Icon className="size-4.5" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentActivity({ audit }: { audit: AuditEvent[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Audit ledger · immutable · 6-year retention</p>
        </div>
        <Badge variant="muted" size="sm"><TrendingUp className="size-3" /> Audit-logged</Badge>
      </div>
      {audit.length === 0 ? (
        <p className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {audit.map((e) => (
            <li key={e.id} className="flex items-start gap-3 p-4 hover:bg-[var(--color-muted)]/40">
              <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-[var(--color-muted)] text-[var(--color-muted-foreground)] font-mono text-[10px]">
                {e.type.split(".")[0].slice(0, 3).toUpperCase()}
              </span>
              <div className="flex-1">
                <p className="text-sm">{e.description}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">
                  {e.actor} · {relativeTime(e.at)} · <span className="font-mono">{e.type}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PendingInvitations({
  pendingStaff,
  pendingPatients,
}: {
  pendingStaff: { id: string; firstName: string; lastName: string; email: string; role: string }[];
  pendingPatients: { id: string; firstName: string; lastName: string; email: string }[];
}) {
  const total = pendingStaff.length + pendingPatients.length;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
        <h2 className="text-sm font-semibold">Pending invitations</h2>
        <Badge variant={total === 0 ? "muted" : "warning"} size="sm">{total}</Badge>
      </div>
      {total === 0 ? (
        <p className="p-8 text-center text-sm text-[var(--color-muted-foreground)]">All invitations accepted.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {pendingStaff.map((s) => (
            <li key={s.id} className="flex items-center gap-3 p-4">
              <Avatar className="size-8"><AvatarFallback>{(s.firstName[0] ?? "") + (s.lastName[0] ?? "")}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{fullName(s)}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">{s.role} · {s.email}</p>
              </div>
              <Badge variant="warning" size="sm" dot>Pending</Badge>
            </li>
          ))}
          {pendingPatients.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-4">
              <Avatar className="size-8"><AvatarFallback>{(p.firstName[0] ?? "") + (p.lastName[0] ?? "")}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{fullName(p)}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">Patient · {p.email}</p>
              </div>
              <Badge variant="warning" size="sm" dot>Pending</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationsCard({ notifications }: { notifications: AdminNotification[] }) {
  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center gap-2">
          <Inbox className="size-4 text-[var(--color-muted-foreground)]" />
          <h2 className="text-sm font-semibold">Notifications</h2>
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">All caught up.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-[var(--color-primary-700)]" />
          <h2 className="text-sm font-semibold">Notifications</h2>
        </div>
        <Badge variant="info" size="sm">{notifications.length} new</Badge>
      </div>
      <ul className="mt-3 space-y-2.5">
        {notifications.map((n) => (
          <li key={n.id}>
            {n.href ? (
              <Link href={n.href} className="block rounded-lg border border-[var(--color-border)] p-3 text-xs hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-muted)]/40">
                <p className="font-medium">{n.title}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{n.body}</p>
              </Link>
            ) : (
              <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs">
                <p className="font-medium">{n.title}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{n.body}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Button asChild variant="ghost" size="sm" className="mt-3 w-full">
        <Link href="/admin/notifications">All notifications <ArrowRight /></Link>
      </Button>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h2 className="text-sm font-semibold">Quick actions</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { label: "Bulk staff import", icon: Users, href: "/admin/users/bulk" },
          { label: "Bulk patient import", icon: UserPlus2, href: "/admin/patients/bulk" },
          { label: "Re-consent campaign", icon: AlertCircle, href: "/admin/consents/campaign" },
          { label: "Schedule policy", icon: Calendar, href: "/admin/appointments" },
          { label: "Templates", icon: Mail, href: "/admin/templates" },
          { label: "Settings", icon: Building2, href: "/admin/settings" },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm font-medium transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)]/40 hover:text-[var(--color-primary-700)]"
            >
              <Icon className="size-4 text-[var(--color-primary)]" /> {a.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
