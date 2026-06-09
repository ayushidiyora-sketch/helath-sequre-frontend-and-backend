"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Eye, Settings2, PauseCircle, PlayCircle, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface Tenant {
  id: string;
  name: string;
  type: string;
  tier: string;
  users: number;
  storage: string;
  region: string;
  status: "active" | "trial" | "suspended" | "archived";
}

interface TenantRowMenuProps {
  tenant: Tenant;
  /** Called after a successful mutation so the parent can refetch the list. */
  onChanged?: () => void | Promise<void>;
}

type DialogKind = "view" | "configure" | "suspend" | null;

const SELECT_CLASS =
  "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15";

/** Per-row tenant actions — opens a details, configure, or suspend dialog. */
export function TenantRowMenu({ tenant, onChanged }: TenantRowMenuProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [submitting, setSubmitting] = useState(false);

  // Configure-form local state, seeded each time the dialog opens.
  const [cfgName, setCfgName] = useState(tenant.name);
  const [cfgTier, setCfgTier] = useState(tenant.tier);
  const [cfgRegion, setCfgRegion] = useState(tenant.region);

  const suspended = tenant.status === "suspended";
  const close = () => setDialog(null);

  function openConfigure() {
    setCfgName(tenant.name);
    setCfgTier(tenant.tier);
    setCfgRegion(tenant.region);
    setDialog("configure");
  }

  async function handleConfigureSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/super/tenants/${encodeURIComponent(tenant.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cfgName, tier: cfgTier, region: cfgRegion }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error("Could not save settings", { description: data.error ?? `HTTP ${res.status}` });
        return;
      }
      toast.success("Tenant settings saved", { description: `${cfgName} · audit-logged` });
      close();
      await onChanged?.();
    } catch {
      toast.error("Network error", { description: "Could not reach the server." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSuspendToggle() {
    const nextStatus = suspended ? "active" : "suspended";
    setSubmitting(true);
    try {
      const res = await fetch(`/api/super/tenants/${encodeURIComponent(tenant.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(`Could not ${suspended ? "reactivate" : "suspend"} tenant`, {
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      if (suspended) {
        toast.success("Tenant reactivated", {
          description: `${tenant.name} is active again · audit-logged`,
        });
      } else {
        toast.warning("Tenant suspended", {
          description: `${tenant.name} · sign-in blocked · audit-logged`,
        });
      }
      close();
      await onChanged?.();
    } catch {
      toast.error("Network error", { description: "Could not reach the server." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${tenant.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
            {tenant.id}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("view")}>
            <Eye /> View tenant
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openConfigure}>
            <Settings2 /> Configure
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/super/tenants/${encodeURIComponent(tenant.id)}/billing`)}>
            <Receipt /> Billing &amp; invoices
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={
              suspended
                ? ""
                : "text-[var(--color-danger)] focus:bg-[var(--color-danger-soft)] focus:text-[var(--color-danger)]"
            }
            onSelect={() => setDialog("suspend")}
          >
            {suspended ? <PlayCircle /> : <PauseCircle />}
            {suspended ? "Reactivate tenant" : "Suspend tenant"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View tenant — read-only detail */}
      <Dialog open={dialog === "view"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{tenant.name}</DialogTitle>
            <DialogDescription className="font-mono text-xs">{tenant.id}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-3 pt-2 text-sm">
            <Detail label="Type" value={tenant.type} />
            <Detail label="Subscription tier" value={tenant.tier} />
            <Detail label="Region" value={tenant.region} />
            <Detail
              label="Status"
              value={
                <Badge
                  variant={
                    suspended
                      ? "danger"
                      : tenant.status === "trial"
                        ? "warning"
                        : tenant.status === "archived"
                          ? "muted"
                          : "success"
                  }
                  size="sm"
                  dot
                >
                  {tenant.status}
                </Badge>
              }
            />
            <Detail label="Users" value={String(tenant.users)} />
            <Detail label="Storage used" value={tenant.storage} />
          </dl>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure tenant — editable settings */}
      <Dialog open={dialog === "configure"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Configure {tenant.name}</DialogTitle>
            <DialogDescription>
              Tenant-level settings. Changes are saved to Postgres and audit-logged.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4 pt-2" onSubmit={handleConfigureSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="cfg-name">Tenant name</Label>
              <Input
                id="cfg-name"
                value={cfgName}
                onChange={(e) => setCfgName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-tier">Subscription tier</Label>
                <select
                  id="cfg-tier"
                  className={SELECT_CLASS}
                  value={cfgTier}
                  onChange={(e) => setCfgTier(e.target.value)}
                >
                  <option>Basic</option>
                  <option>Pro</option>
                  <option>Enterprise</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cfg-region">Region</Label>
                <select
                  id="cfg-region"
                  className={SELECT_CLASS}
                  value={cfgRegion}
                  onChange={(e) => setCfgRegion(e.target.value)}
                >
                  <option>ap-south-1</option>
                  <option>us-east-1</option>
                  <option>eu-west-1</option>
                  <option>ap-southeast-2</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" /> Saving…
                  </>
                ) : (
                  "Save settings"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Suspend / reactivate confirm */}
      <Dialog open={dialog === "suspend"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {suspended ? "Reactivate" : "Suspend"} {tenant.name}?
            </DialogTitle>
            <DialogDescription>
              {suspended
                ? "Users of this tenant will be able to sign in again. This action is audit-logged."
                : "All users of this tenant will be blocked from signing in until it is reactivated. This action is audit-logged."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant={suspended ? "default" : "destructive"}
              onClick={handleSuspendToggle}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> Working…
                </>
              ) : suspended ? (
                "Reactivate"
              ) : (
                "Suspend tenant"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
