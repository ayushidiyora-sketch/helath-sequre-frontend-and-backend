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

/** Modal for opening a new platform incident. */
export function OpenIncidentDialog() {
  const [open, setOpen] = useState(false);

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

        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            toast.success("Incident opened · INC-0023", {
              description: "On-call paged · runbook attached",
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="inc-title">Title</Label>
            <Input id="inc-title" placeholder="Short summary of the issue" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inc-sev">Severity</Label>
              <select id="inc-sev" className={SELECT_CLASS} defaultValue="Minor">
                <option>Minor</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-scope">Scope</Label>
              <select id="inc-scope" className={SELECT_CLASS} defaultValue="Platform-wide">
                <option>Platform-wide</option>
                <option>Single tenant</option>
                <option>Single region</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-affected">Affected tenant / region (optional)</Label>
            <Input id="inc-affected" placeholder="e.g., org_greenleaf · ap-south-1" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-desc">Description</Label>
            <Textarea id="inc-desc" rows={3} placeholder="What is happening, and what is the impact?" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Open incident</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
