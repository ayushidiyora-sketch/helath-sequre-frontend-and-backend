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
import { Switch } from "@/components/ui/switch";
import type { SubscriptionTier } from "@/lib/tiers";

/**
 * Edit-tier modal — writes to `subscription_tiers` via PATCH so the change
 * shows on the public pricing page too. `onSaved` receives the refreshed list.
 */
export function EditTierDialog({
  tier,
  onSaved,
}: {
  tier: SubscriptionTier;
  onSaved: (tiers: SubscriptionTier[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(tier.name);
  const [tagline, setTagline] = useState(tier.tagline);
  const [monthly, setMonthly] = useState(tier.monthly === null ? "" : String(tier.monthly));
  const [annual, setAnnual] = useState(tier.annualMonthly === null ? "" : String(tier.annualMonthly));
  const [unit, setUnit] = useState(tier.unit);
  const [ctaLabel, setCtaLabel] = useState(tier.ctaLabel);
  const [featured, setFeatured] = useState(tier.featured);
  const [bullets, setBullets] = useState(tier.bullets.join("\n"));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch(`/api/super/tiers/${tier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          tagline,
          monthly: monthly.trim() === "" ? null : Number(monthly),
          annualMonthly: annual.trim() === "" ? null : Number(annual),
          unit,
          ctaLabel,
          featured,
          bullets: bullets.split("\n").map((b) => b.trim()).filter(Boolean),
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; tiers?: SubscriptionTier[] };
      if (!r.ok || !j.ok) {
        toast.error("Could not update tier", { description: j.error ?? `HTTP ${r.status}` });
        return;
      }
      if (j.tiers) onSaved(j.tiers);
      setOpen(false);
      toast.success(`${name} tier updated`, { description: "Live on the pricing page · audit-logged" });
    } catch {
      toast.error("Network error — tier not saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          Edit tier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Edit {tier.name} tier</DialogTitle>
          <DialogDescription>
            Changes go live on the public pricing page · audit-logged.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 pt-2" onSubmit={save}>
          <div className="space-y-1.5">
            <Label htmlFor="tier-name">Name</Label>
            <Input id="tier-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-tagline">Tagline</Label>
            <Input id="tier-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tier-monthly">Monthly price ($) · blank = Custom</Label>
              <Input id="tier-monthly" type="number" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="Custom" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tier-annual">Annual /mo ($)</Label>
              <Input id="tier-annual" type="number" min="0" value={annual} onChange={(e) => setAnnual(e.target.value)} placeholder="—" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-unit">Unit label</Label>
            <Input id="tier-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="per clinician / month" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-cta">CTA label</Label>
            <Input id="tier-cta" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Most popular</p>
              <p className="text-[11px] text-[var(--color-muted-foreground)]">Highlights this tier (only one at a time)</p>
            </div>
            <Switch checked={featured} onCheckedChange={setFeatured} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-bullets">Features · one per line</Label>
            <Textarea id="tier-bullets" rows={6} value={bullets} onChange={(e) => setBullets(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save tier"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
