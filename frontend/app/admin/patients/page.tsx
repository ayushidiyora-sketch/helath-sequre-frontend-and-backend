"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Check,
  Plus,
  ChevronRight,
  ChevronLeft,
  Upload,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface Patient {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  profilePhotoUrl: string | null;
  status: "active" | "invited" | "suspended" | "deactivated";
  createdAt: string;
  mrn: string;
  /** True when the patient has at least one active patient_assignments row. */
  assigned: boolean;
  /** "Dr. Priya Shah" — primary clinician on file, null if no active assignment. */
  assignedDoctor: string | null;
  assignedDoctorDesignation: string | null;
  assignedDoctorsCount: number;
}

type StatusKey = "active" | "deactivated";
const PAGE_SIZE = 10;

function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`.trim();
}

function initialsOf(p: { firstName: string; lastName: string }) {
  return ((p.firstName[0] ?? "") + (p.lastName[0] ?? "")).toUpperCase();
}

function formatEnrolled(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<StatusKey[]>([]);
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/patients", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? `HTTP ${r.status}`);
        return;
      }
      setPatients(data.patients);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load patients");
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

  useEffect(() => {
    setPage(1);
  }, [query, statusFilters]);

  function toggleStatus(s: StatusKey) {
    setStatusFilters((curr) => (curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]));
  }
  function clearFilters() {
    setStatusFilters([]);
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      if (statusFilters.length > 0) {
        const isActive = p.status === "active" || p.status === "invited";
        const isDeact = p.status === "deactivated";
        if (statusFilters.includes("active") && !statusFilters.includes("deactivated") && !isActive) return false;
        if (statusFilters.includes("deactivated") && !statusFilters.includes("active") && !isDeact) return false;
      }
      if (
        q &&
        !`${p.name} ${p.email} ${p.phone ?? ""} ${p.mrn} ${p.assignedDoctor ?? ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [patients, query, statusFilters]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paged = visible.slice(pageStart, pageStart + PAGE_SIZE);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      active: patients.filter((p) => p.status === "active").length,
      invited: patients.filter((p) => p.status === "invited").length,
      newThisMonth: patients.filter((p) => {
        const d = new Date(p.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      deactivated: patients.filter((p) => p.status === "deactivated").length,
    };
  }, [patients]);

  const activeFilterCount = statusFilters.length;

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
                <Button variant={activeFilterCount > 0 ? "soft" : "outline"} size="sm">
                  <Filter /> Filter{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    toggleStatus("active");
                  }}
                >
                  {statusFilters.includes("active") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Active
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    toggleStatus("deactivated");
                  }}
                >
                  {statusFilters.includes("deactivated") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Deactivated
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={clearFilters}>Clear filters</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/patients/bulk">
                <Upload /> Bulk CSV
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Active" value={stats.active} accent="success" />
        <Stat label="Invited" value={stats.invited} accent="warning" />
        <Stat label="New this month" value={stats.newThisMonth} />
        <Stat label="Deactivated" value={stats.deactivated} />
      </div>

      <Input
        placeholder="Search by name, MRN, email, phone…"
        leadingIcon={<Search />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="grid grid-cols-12 gap-4 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <div className="col-span-4">Patient</div>
          <div className="col-span-2">MRN</div>
          <div className="col-span-2">Enrolled</div>
          <div className="col-span-3">Assigned doctor</div>
          <div className="col-span-1 text-right">Status</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 className="size-4 animate-spin" /> Loading patients…
          </div>
        ) : error ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-danger)]">Failed to load — {error}</p>
        ) : visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
            {patients.length === 0
              ? "No patients enrolled in this tenant yet."
              : "No patients match the current filters."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {paged.map((p) => (
              <PatientRow key={p.id} patient={p} />
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
              of <span className="font-medium text-[var(--color-foreground)]">{visible.length}</span>
            </span>
            <div className="inline-flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setPage((pp) => Math.max(1, pp - 1))}
              >
                <ChevronLeft />
              </Button>
              <span className="px-2 tabular-nums text-[var(--color-muted-foreground)]">
                Page <span className="font-medium text-[var(--color-foreground)]">{currentPage}</span> of{" "}
                <span className="font-medium text-[var(--color-foreground)]">{totalPages}</span>
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((pp) => Math.min(totalPages, pp + 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </div>
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

function PatientRow({ patient }: { patient: Patient }) {
  const initials = initialsOf(patient);
  const photo =
    patient.profilePhotoUrl && /^(data:|https?:)/i.test(patient.profilePhotoUrl)
      ? patient.profilePhotoUrl
      : null;
  return (
    <li>
      <Link
        href={`/admin/patients/${patient.id}`}
        className="grid grid-cols-12 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-muted)]/40"
      >
        <div className="col-span-4 flex items-center gap-3 min-w-0">
          <Avatar className="size-9">
            {photo && <AvatarImage src={photo} alt={fullName(patient)} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{fullName(patient)}</p>
            {patient.gender && (
              <p className="truncate text-[11px] text-[var(--color-muted-foreground)]">{patient.gender}</p>
            )}
          </div>
        </div>
        <div className="col-span-2 font-mono text-xs">{patient.mrn}</div>
        <div className="col-span-2 text-xs text-[var(--color-muted-foreground)]">
          {formatEnrolled(patient.createdAt)}
        </div>
        <div className="col-span-3 min-w-0 space-y-0.5 text-xs">
          {patient.assignedDoctor ? (
            <>
              <p className="truncate font-medium text-[var(--color-foreground)]">
                {patient.assignedDoctor}
              </p>
              <p className="truncate text-[10px] text-[var(--color-muted-foreground)]">
                {patient.assignedDoctorDesignation ?? "Clinician"}
                {patient.assignedDoctorsCount > 1
                  ? ` · +${patient.assignedDoctorsCount - 1} more`
                  : ""}
              </p>
            </>
          ) : (
            <p className="truncate italic text-[var(--color-muted-foreground)]">
              No clinician assigned
            </p>
          )}
        </div>
        <div className="col-span-1 flex items-center justify-end gap-1">
          {!patient.assigned && (
            <Badge variant="muted" size="sm">
              Unassigned
            </Badge>
          )}
          <StatusBadge status={patient.status} />
          <ChevronRight className="size-4 text-[var(--color-muted-foreground)]" />
        </div>
      </Link>
    </li>
  );
}

function StatusBadge({ status }: { status: Patient["status"] }) {
  if (status === "deactivated") return <Badge variant="muted" size="sm">Deact.</Badge>;
  if (status === "suspended")
    return (
      <Badge variant="danger" size="sm" dot>
        Susp.
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
