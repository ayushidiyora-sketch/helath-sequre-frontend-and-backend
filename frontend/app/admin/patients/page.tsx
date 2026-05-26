"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Check,
  Plus,
  ChevronRight,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { InvitePatientDialog } from "@/components/shared/form-dialogs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PATIENTS } from "./patients-data";
import { useAdminStore } from "@/lib/admin-store";

type Status = "active" | "deactivated";

const PATIENT_TYPES = Array.from(new Set(PATIENTS.map((p) => p.patientType))).sort();

export default function AdminPatientsPage() {
  const { state, addPatient, markOnboardingStep } = useAdminStore();
  const [query, setQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<Status[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);

  function toggleStatus(s: Status) {
    setStatusFilters((curr) => (curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]));
  }
  function toggleType(t: string) {
    setTypeFilters((curr) => (curr.includes(t) ? curr.filter((x) => x !== t) : [...curr, t]));
  }
  function clearFilters() {
    setStatusFilters([]);
    setTypeFilters([]);
  }

  const q = query.trim().toLowerCase();

  // Merge admin-store patients (just-invited via dialog) ahead of the static
  // mock roster so demo additions surface immediately at the top.
  const storeMapped = useMemo(
    () =>
      state.patients.map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        initials: ((p.firstName[0] ?? "") + (p.lastName[0] ?? "")).toUpperCase(),
        mrn: p.mrn,
        email: p.email,
        since: new Date(p.registeredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        clinician: state.assignments.find((a) => a.patientId === p.id && a.status === "active")
          ? state.staff.find((s) => s.id === state.assignments.find((a) => a.patientId === p.id && a.status === "active")?.clinicianId)?.firstName ?? "—"
          : "Unassigned",
        status: p.status === "deactivated" ? ("deactivated" as Status) : ("active" as Status),
        patientType: "Standard",
        invitationStatus: p.invitationStatus,
      })),
    [state.patients, state.assignments, state.staff],
  );

  const all = useMemo(() => {
    const storeIds = new Set(storeMapped.map((p) => p.mrn));
    return [...storeMapped, ...PATIENTS.filter((p) => !storeIds.has(p.mrn)).map((p) => ({ ...p, invitationStatus: "accepted" as const }))];
  }, [storeMapped]);

  const filtered = useMemo(
    () =>
      all.filter((p) => {
        if (statusFilters.length > 0 && !statusFilters.includes(p.status)) return false;
        if (typeFilters.length > 0 && !typeFilters.includes(p.patientType)) return false;
        if (q && ![p.name, p.mrn, p.email].some((f) => f.toLowerCase().includes(q))) return false;
        return true;
      }),
    [all, q, statusFilters, typeFilters],
  );

  const activeCount = statusFilters.length + typeFilters.length;

  return (
    <>
      <PageHeader
        eyebrow="Patients"
        title="Patient roster"
        description="View and manage all patients enrolled in your organization. PHI content remains invisible — only operational metadata."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter /> Filter{activeCount > 0 ? ` · ${activeCount}` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("active"); }}>
                  {statusFilters.includes("active") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Active
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("deactivated"); }}>
                  {statusFilters.includes("deactivated") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Deactivated
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Patient type</DropdownMenuLabel>
                {PATIENT_TYPES.map((t) => (
                  <DropdownMenuItem key={t} onSelect={(e) => { e.preventDefault(); toggleType(t); }}>
                    {typeFilters.includes(t) ? <Check className="size-3.5" /> : <span className="size-3.5" />} {t}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={clearFilters}>Clear filters</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/patients/bulk"><Upload /> Bulk CSV</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/patients/invite">Register patient</Link>
            </Button>
            <InvitePatientDialog
              triggerLabel={<><Plus /> Invite patient</>}
              triggerProps={{ size: "sm" }}
              onCreated={({ name, email }) => {
                const parts = name.split(/\s+/);
                addPatient({
                  firstName: parts[0] ?? name,
                  lastName: parts.slice(1).join(" "),
                  email,
                  phone: "+91 90000 00000",
                  age: 30,
                  sex: "Other",
                });
                markOnboardingStep("firstPatientInvited", true);
              }}
            />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Active", value: all.filter((p) => p.status === "active").length.toLocaleString() },
          { label: "Onboarded this month", value: state.patients.filter((p) => new Date(p.registeredAt).getMonth() === new Date().getMonth()).length, trend: state.patients.length > 0 ? "+demo" : "" },
          { label: "Pending invitations", value: state.patients.filter((p) => p.invitationStatus === "pending").length },
          { label: "Deactivated", value: all.filter((p) => p.status === "deactivated").length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            {s.trend && (
              <p className="text-[11px] text-[var(--color-success)] inline-flex items-center gap-1"><TrendingUp className="size-3" /> {s.trend}</p>
            )}
          </div>
        ))}
      </div>

      <Input
        placeholder="Search by name, MRN, email…"
        leadingIcon={<Search />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="grid grid-cols-12 gap-4 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <div className="col-span-4">Patient</div>
          <div className="col-span-2">MRN</div>
          <div className="col-span-2">Enrolled</div>
          <div className="col-span-3">Assigned clinician</div>
          <div className="col-span-1 text-right">Status</div>
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
            No patients match the current filters.
          </p>
        ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {filtered.map((p) => (
            <li key={p.mrn}>
              <Link
                href={`/admin/patients/${p.id}`}
                className="grid grid-cols-12 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-muted)]/40"
              >
                <div className="col-span-4 flex items-center gap-3">
                  <Avatar className="size-9"><AvatarFallback>{p.initials}</AvatarFallback></Avatar>
                  <p className="text-sm font-semibold">{p.name}</p>
                </div>
                <div className="col-span-2 font-mono text-xs">{p.mrn}</div>
                <div className="col-span-2 text-xs text-[var(--color-muted-foreground)]">{p.since}</div>
                <div className="col-span-3 text-sm">{p.clinician}</div>
                <div className="col-span-1 flex items-center justify-end gap-1">
                  {p.status === "active" ? (
                    <Badge variant="success" size="sm" dot>Active</Badge>
                  ) : (
                    <Badge variant="muted" size="sm">Deact.</Badge>
                  )}
                  <ChevronRight className="size-4 text-[var(--color-muted-foreground)]" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
        )}
      </div>
    </>
  );
}
