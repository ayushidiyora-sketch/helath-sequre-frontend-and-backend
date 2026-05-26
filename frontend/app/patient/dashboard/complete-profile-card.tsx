"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  ShieldCheck,
  IdCard,
  MapPin,
  Phone,
  HeartPulse,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SELECT_CLASS =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

const ITEMS = [
  { icon: IdCard, label: "Aadhaar / ABHA" },
  { icon: MapPin, label: "Home address" },
  { icon: Phone, label: "Emergency contact" },
  { icon: ShieldCheck, label: "Insurance" },
  { icon: HeartPulse, label: "Allergies & history" },
];

export function CompleteProfileCard() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setOpen(false);
      setDone(true);
      toast.success("Profile saved", { description: "Audit-logged" });
    }, 600);
  }

  if (done) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-primary)]/25 bg-gradient-to-br from-[var(--color-primary-50)]/60 via-[var(--color-card)] to-[var(--color-card)] p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[var(--color-primary)]/15 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
            <Sparkles className="size-3.5" /> Optional
          </div>
          <h2 className="mt-1 text-sm font-semibold">Complete your profile</h2>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Helps your care team treat you faster. You can fill any of this
            whenever you like.
          </p>
          <ul className="mt-3 space-y-1.5">
            {ITEMS.map((it) => {
              const Icon = it.icon;
              return (
                <li
                  key={it.label}
                  className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]"
                >
                  <Icon className="size-3.5 text-[var(--color-primary-700)]" />
                  {it.label}
                </li>
              );
            })}
          </ul>
          <DialogTrigger asChild>
            <Button size="sm" className="mt-4 w-full">
              Complete profile <ArrowRight />
            </Button>
          </DialogTrigger>
        </div>
      </div>

      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Complete your profile</DialogTitle>
          <DialogDescription>
            Everything here is optional and can be updated later from your
            settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="rounded-xl border border-[var(--color-border)] p-3.5">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <IdCard className="size-3.5" /> Aadhaar / ABHA
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-aadhaar">Aadhaar number</Label>
                <Input
                  id="profile-aadhaar"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="XXXX XXXX XXXX"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-abha">ABHA number / ID</Label>
                <Input id="profile-abha" placeholder="14-digit ABHA or @abdm address" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
              Stored encrypted · used only for record linking with consent.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-address">Home address</Label>
            <Textarea id="profile-address" rows={2} placeholder="Street, city, postal code" />
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-3.5">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <Phone className="size-3.5" /> Emergency contact
            </p>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Contact name" />
                <Input placeholder="Contact phone" />
              </div>
              <select className={SELECT_CLASS} defaultValue="">
                <option value="">Relationship…</option>
                <option>Spouse</option>
                <option>Parent</option>
                <option>Sibling</option>
                <option>Child</option>
                <option>Friend</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-3.5">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <ShieldCheck className="size-3.5" /> Insurance
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Provider" />
              <Input placeholder="Policy number" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-allergies">Known allergies</Label>
            <Input
              id="profile-allergies"
              leadingIcon={<HeartPulse />}
              placeholder="e.g., Penicillin (or leave blank)"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-history">Brief medical history</Label>
            <Textarea
              id="profile-history"
              rows={2}
              placeholder="Existing conditions, ongoing medication…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : (
                <>
                  <CheckCircle2 /> Save profile
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
