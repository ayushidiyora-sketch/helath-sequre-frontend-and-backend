"use client";

import { toast } from "sonner";
import { MoreHorizontal, Pencil, Users, Clock, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/** Per-department actions menu. */
export function DeptRowMenu({ name }: { name: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toast.info("Edit department", { description: name })}>
          <Pencil /> Edit department
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast.info("Manage clinicians", { description: `${name} · assignments` })}>
          <Users /> Manage clinicians
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast.info("Slot defaults", { description: `${name} · appointment slots` })}>
          <Clock /> Slot defaults
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-[var(--color-danger)] focus:bg-[var(--color-danger-soft)] focus:text-[var(--color-danger)]"
          onSelect={() => toast.warning("Department archived", { description: `${name} · audit-logged` })}
        >
          <Archive /> Archive department
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
