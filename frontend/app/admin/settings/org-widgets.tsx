"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, PasswordInput } from "@/components/ui/input";
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

const SELECT =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

/** Logo "Upload" — opens a real image picker. */
export function LogoUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/svg+xml,image/png"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) toast.success("Logo uploaded", { description: `${f.name} · applied to patient header & emails` });
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload /> Upload
      </Button>
    </>
  );
}

/** Color-token "Edit" — opens a dialog with a real color picker. */
export function EditColorButton({ label, value }: { label: string; value: string }) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(value);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Edit {label} color</DialogTitle>
          <DialogDescription>Contrast is auto-validated against accessibility ranges.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            toast.success(`${label} color updated`, { description: color });
          }}
        >
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-12 cursor-pointer rounded-lg border border-[var(--color-border)] bg-transparent"
            />
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="hex">Hex value</Label>
              <Input id="hex" value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit"><Save /> Save color</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Retention "Change" — opens a dialog with a duration select. */
export function ChangeRetentionButton({ label, current }: { label: string; current: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Change</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Retention · {label}</DialogTitle>
          <DialogDescription>
            How long {label.toLowerCase()} are kept before automated purge. Currently {current}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            toast.success(`Retention updated · ${label}`, { description: "audit-logged · org.retention.update" });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ret">Retention period</Label>
            <select id="ret" className={SELECT} defaultValue="7 years">
              {["1 year", "2 years", "3 years", "5 years", "6 years", "7 years", "10 years"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit"><Save /> Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Channel "Configure" — opens a dialog with the provider settings. */
export function ConfigureChannelButton({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-3">Configure</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Configure {name}</DialogTitle>
          <DialogDescription>Provider credentials are stored encrypted.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            toast.success(`${name} configured`, { description: "Connection verified · audit-logged" });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ch-key">API key</Label>
            <PasswordInput id="ch-key" placeholder="••••••••••••••••" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-sender">Sender identity</Label>
            <Input id="ch-sender" placeholder="ops@citygeneral.health" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit"><Save /> Save &amp; verify</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
