"use client";

import { useState } from "react";
import { toast } from "sonner";
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

interface Tier {
  name: string;
  price: string;
  users: string | number;
  storage: string;
  features: string;
}

/** Edit-tier modal for the platform subscription tiers. */
export function EditTierDialog({ tier }: { tier: Tier }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="mt-4 w-full">
          Edit tier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit {tier.name} tier</DialogTitle>
          <DialogDescription>
            Changes propagate to every tenant on this tier · audit-logged.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            toast.success(`${tier.name} tier updated`, {
              description: "Propagated to all tenants on this tier",
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="tier-price">Monthly price</Label>
            <Input id="tier-price" defaultValue={tier.price} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tier-users">User limit</Label>
              <Input id="tier-users" defaultValue={String(tier.users)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tier-storage">Storage</Label>
              <Input id="tier-storage" defaultValue={tier.storage} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-features">Included features</Label>
            <Textarea id="tier-features" defaultValue={tier.features} rows={2} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Save tier</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
