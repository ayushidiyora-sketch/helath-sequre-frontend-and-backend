"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Building2, Send, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useAdminStore } from "@/lib/admin-store";

const SELECT =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

export default function NewDepartmentPage() {
  const router = useRouter();
  const { state, addDepartment, markOnboardingStep } = useAdminStore();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const dept = addDepartment(name.trim(), parentId || null, description.trim() || undefined);
    markOnboardingStep("departmentsCreated", true);
    toast.success("Department created", {
      description: `${dept.name} · ID ${dept.id}`,
    });
    router.push("/admin/departments");
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/admin/departments" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Departments
        </Link>
        <span>/</span>
        <span>New department</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create a department</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Departments group clinicians and set default appointment-slot lengths.
          You can nest a department under a parent.
        </p>
      </div>

      <form className="max-w-2xl space-y-5" onSubmit={submit}>
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
                {state.departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slot">Default slot length</Label>
              <select id="slot" className={SELECT} defaultValue="30">
                <option value="10">10-min slots</option>
                <option value="15">15-min slots</option>
                <option value="20">20-min slots</option>
                <option value="30">30-min slots</option>
                <option value="45">45-min slots</option>
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
            <Button asChild variant="outline">
              <Link href="/admin/departments">Cancel</Link>
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              <Send /> Create department
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
