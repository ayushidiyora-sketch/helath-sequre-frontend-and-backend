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
import { Input, Label } from "@/components/ui/input";

/** Modal for adding an IP range to the Super Admin allowlist. */
export function AddRangeDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus /> Add range
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add an allowlisted IP range</DialogTitle>
          <DialogDescription>
            Sign-in is blocked from any address outside this list. Changes take
            effect immediately and are audit-logged.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            toast.success("IP range added", {
              description: "Allowlist updated · audit-logged",
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cidr">CIDR range</Label>
            <Input id="cidr" placeholder="203.0.113.0/24" className="font-mono" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cidr-label">Label</Label>
            <Input id="cidr-label" placeholder="e.g., Sensussoft Pune office" required />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Add range</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
