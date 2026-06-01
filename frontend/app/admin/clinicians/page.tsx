"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Calendar,
  ChevronRight,
  Plus,
  Stethoscope,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";

interface Clinician {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: "active" | "invited" | "suspended" | "deactivated";
  designation: string | null;
  department: string | null;
  profilePhotoUrl: string | null;
  mfaRequired: boolean;
  createdAt: string;
}

export default function AdminCliniciansPage() {
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? `HTTP ${r.status}`);
        return;
      }
      setClinicians(
        (data.staff as Clinician[]).filter((s) => s.role === "Clinician"),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clinicians");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return (
    <>
      <PageHeader
        eyebrow="Clinicians"
        title="Clinical team"
        description="Manage clinician panels, slot templates, and department assignments."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/users/invite">
              <Plus /> Invite clinician
            </Link>
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="size-4 animate-spin" /> Loading clinicians…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-6 text-sm text-[var(--color-danger)]">
          Failed to load — {error}
        </div>
      ) : clinicians.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center">
          <Stethoscope className="size-7 text-[var(--color-primary-700)]" />
          <p className="text-sm font-semibold">No clinicians yet</p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            Invite your first clinical staff member to start building the panel.
          </p>
          <Button asChild size="sm" className="mt-1">
            <Link href="/admin/users/invite">
              <Plus /> Invite clinician
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {clinicians.map((c) => (
            <ClinicianCard key={c.id} clinician={c} />
          ))}
        </div>
      )}
    </>
  );
}

function ClinicianCard({ clinician }: { clinician: Clinician }) {
  const initials = ((clinician.firstName[0] ?? "") + (clinician.lastName[0] ?? "")).toUpperCase();
  const photo =
    clinician.profilePhotoUrl && /^(data:|https?:)/i.test(clinician.profilePhotoUrl)
      ? clinician.profilePhotoUrl
      : null;
  // Panel/utilization placeholders — wire up to a real `patient_assignments`
  // table once that schema lands.
  const panelSize = 0;
  const utilization = 0;
  return (
    <Link
      href={`/admin/users/${clinician.slug}`}
      className="group overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-start gap-4 border-b border-[var(--color-border)] p-5">
        <Avatar className="size-12">
          {photo && <AvatarImage src={photo} alt={`${clinician.firstName} ${clinician.lastName}`} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">
              Dr. {clinician.firstName} {clinician.lastName}
            </p>
            {clinician.status === "invited" && (
              <Badge variant="warning" size="sm" dot>
                Invited
              </Badge>
            )}
            {clinician.status === "deactivated" && (
              <Badge variant="muted" size="sm">
                Deactivated
              </Badge>
            )}
            {clinician.status === "active" && (
              <Badge variant="success" size="sm" dot>
                <ShieldCheck /> Active
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-[var(--color-muted-foreground)]">
            {clinician.designation ?? "—"}
            {clinician.department ? ` · ${clinician.department}` : ""}
          </p>
          <p className="truncate text-[11px] text-[var(--color-muted-foreground)]">{clinician.email}</p>
        </div>
        <ChevronRight className="size-4 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="grid grid-cols-3 divide-x divide-[var(--color-border)]">
        <div className="p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Panel
          </p>
          <p className="mt-1 text-lg font-semibold inline-flex items-center gap-1.5">
            <Users className="size-4 text-[var(--color-muted-foreground)]" />
            {panelSize}
          </p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Status
          </p>
          <p className="mt-1 text-xs inline-flex items-center gap-1.5">
            <Calendar className="size-3.5 text-[var(--color-muted-foreground)]" />
            {clinician.status === "active" ? "Active" : clinician.status[0].toUpperCase() + clinician.status.slice(1)}
          </p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Utilization
          </p>
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
