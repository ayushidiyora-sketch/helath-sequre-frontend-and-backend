"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

const SELECT_CLASS =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

/**
 * Modal for opening a new manual platform incident. POSTs to
 * `/api/super/incidents` which inserts a row in the `incidents` table.
 * Auto-derived incidents (locked accounts, infected uploads, etc.) materialize
 * on their own and shouldn't be opened from this dialog.
 */
export function OpenIncidentDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<"minor" | "high" | "medium">("minor");
  const [scope, setScope] = useState<"platform" | "tenant" | "region">("platform");
  const [affected, setAffected] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle("");
    setSeverity("minor");
    setScope("platform");
    setAffected("");
    setDescription("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const scopeStr =
        scope === "platform"
          ? "platform"
          : `${scope}:${affected.trim() || "unspecified"}`;
      // Description is rolled into the title with a separator so the API stays
      // minimal — no separate description column needed.
      const fullTitle = description.trim() ? `${title.trim()} — ${description.trim()}` : title.trim();
      const r = await fetch("/api/super/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: fullTitle, severity, scope: scopeStr }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        toast.error(data?.error ?? "Could not open incident.");
        return;
      }
      toast.success(`Incident opened · ${data.incident.display}`, {
        description: "On-call paged · runbook attached · audit-logged",
      });
      reset();
      setOpen(false);
      onCreated?.();
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Open incident
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Open a new incident</DialogTitle>
          <DialogDescription>
            Creates an incident record, pages the on-call engineer, and attaches a
            runbook · audit-logged.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 pt-2" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="inc-title">Title</Label>
            <Input
              id="inc-title"
              placeholder="Short summary of the issue"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inc-sev">Severity</Label>
              <select
                id="inc-sev"
                className={SELECT_CLASS}
                value={severity}
                onChange={(e) => setSeverity(e.target.value as typeof severity)}
              >
                <option value="minor">Minor</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-scope">Scope</Label>
              <select
                id="inc-scope"
                className={SELECT_CLASS}
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
              >
                <option value="platform">Platform-wide</option>
                <option value="tenant">Single tenant</option>
                <option value="region">Single region</option>
              </select>
            </div>
          </div>
          {scope !== "platform" && (
            <div className="space-y-1.5">
              <Label htmlFor="inc-affected">Affected {scope} (optional)</Label>
              <Input
                id="inc-affected"
                placeholder={scope === "tenant" ? "e.g., org_greenleaf" : "e.g., ap-south-1"}
                value={affected}
                onChange={(e) => setAffected(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="inc-desc">Description</Label>
            <Textarea
              id="inc-desc"
              rows={3}
              placeholder="What is happening, and what is the impact?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? "Opening…" : "Open incident"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
