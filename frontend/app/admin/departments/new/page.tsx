"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Building2, Send, FolderTree, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

const SELECT =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

interface Parent {
  id: string;
  name: string;
}

export default function NewDepartmentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [description, setDescription] = useState("");

  const [parents, setParents] = useState<Parent[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate the parent dropdown from existing departments in this tenant.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/departments", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; departments?: Parent[] } | null) => {
        if (cancelled || !data?.ok) return;
        setParents(data.departments ?? []);
      })
      .catch(() => {
        /* fall back to empty parents list — top-level only */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Department name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parentId: parentId || null,
          description: description.trim() || null,
          defaultSlotMinutes: slotMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not create department.");
        setSubmitting(false);
        return;
      }
      toast.success("Department created", {
        description: `${data.department.name} · ${data.department.defaultSlotMinutes}-min slots`,
      });
      router.push("/admin/departments");
    } catch {
      setError("Network error — could not reach the server.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/admin/departments"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Departments
        </Link>
        <span>/</span>
        <span>New department</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create a department</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Departments group clinicians and set default appointment-slot lengths. You can nest a
          department under a parent.
        </p>
      </div>

      <form className="max-w-2xl space-y-5" onSubmit={submit}>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
          >
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4" /> Department details
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Department name</Label>
              <Input
                id="name"
                placeholder="e.g., Orthopedics"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parent">Parent department</Label>
              <select
                id="parent"
                className={SELECT}
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">None — top level</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slot">Default slot length</Label>
              <select
                id="slot"
                className={SELECT}
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(Number(e.target.value))}
              >
                <option value={10}>10-min slots</option>
                <option value={15}>15-min slots</option>
                <option value={20}>20-min slots</option>
                <option value={30}>30-min slots</option>
                <option value={45}>45-min slots</option>
                <option value={60}>60-min slots</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="desc">Description (optional)</Label>
              <Textarea
                id="desc"
                rows={2}
                placeholder="What this department covers."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
            <FolderTree className="size-3.5" /> Hierarchy can be changed later
          </span>
          <div className="flex gap-2">
            <Button asChild variant="outline" type="button" disabled={submitting}>
              <Link href="/admin/departments">Cancel</Link>
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Send /> Create department
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
