"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Stethoscope,
  FolderTree,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/shared/action-button";

interface Department {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  defaultSlotMinutes: number;
  clinicianCount: number;
  childCount: number;
  createdAt: string;
}

const ACCENTS = [
  "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]",
  "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]",
  "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]",
  "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]",
  "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]",
];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/departments", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? `HTTP ${r.status}`);
        return;
      }
      setDepartments(data.departments);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load departments");
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

  async function handleDelete(d: Department) {
    try {
      const r = await fetch(`/api/admin/departments/${d.id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        toast.error("Cannot delete", { description: data.error ?? `HTTP ${r.status}` });
        return;
      }
      toast.warning("Department removed", { description: d.name });
      await refresh();
    } catch {
      toast.error("Cannot delete", { description: "Network error" });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Departments"
        title="Departments & hierarchy"
        description="Group clinicians, set slot defaults, and manage parent-child relationships."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/departments/new">
              <Plus /> New department
            </Link>
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="size-4 animate-spin" /> Loading departments…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-6 text-sm text-[var(--color-danger)]">
          Failed to load departments — {error}
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center">
          <Building2 className="size-7 text-[var(--color-primary-700)]" />
          <p className="text-sm font-semibold">No departments yet</p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            Create departments to group clinicians, route assignments, and manage scheduling.
          </p>
          <Button asChild size="sm" className="mt-1">
            <Link href="/admin/departments/new">
              <Plus /> Create first department
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <DepartmentCard
              key={d.id}
              department={d}
              accent={colorFor(d.id)}
              onDelete={() => handleDelete(d)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function DepartmentCard({
  department,
  accent,
  onDelete,
}: {
  department: Department;
  accent: string;
  onDelete: () => void;
}) {
  const blocked = department.clinicianCount > 0 || department.childCount > 0;
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-all hover:shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <span
          className={`flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-[var(--shadow-soft)]`}
        >
          <Building2 className="size-5" />
        </span>
        {blocked ? (
          <Badge variant="muted" size="sm">
            {department.childCount > 0
              ? "Has sub-depts"
              : `${department.clinicianCount} clinician${department.clinicianCount === 1 ? "" : "s"}`}
          </Badge>
        ) : (
          <ActionButton
            variant="ghost"
            size="icon-sm"
            confirm={{
              title: `Delete ${department.name}?`,
              description:
                "This department has no clinicians or sub-departments. Removal is audit-logged.",
              confirmLabel: "Delete",
              variant: "destructive",
            }}
            onClick={onDelete}
            aria-label="Delete department"
            className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
          >
            <Trash2 />
          </ActionButton>
        )}
      </div>
      <p className="mt-3 text-base font-semibold">{department.name}</p>
      {department.parentName && (
        <p className="text-[11px] text-[var(--color-muted-foreground)] inline-flex items-center gap-1">
          <FolderTree className="size-3" /> Under {department.parentName}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
          <Stethoscope className="size-3.5" /> {department.clinicianCount} clinician
          {department.clinicianCount === 1 ? "" : "s"}
        </span>
        <Badge variant="muted" size="sm">
          {department.defaultSlotMinutes}-min slots
        </Badge>
      </div>
    </div>
  );
}
