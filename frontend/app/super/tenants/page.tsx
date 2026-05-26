"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Check,
  Plus,
  Users,
  HardDrive,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/shared/action-button";
import { TenantRowMenu } from "./tenant-row-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const tenants = [
  { id: "org_citygen", name: "City General Hospital", type: "Hospital", tier: "Enterprise", users: 64, patients: 4128, storage: "612 GB", region: "ap-south-1", status: "active" as const },
  { id: "org_riverside", name: "Riverside Family Clinic", type: "Clinic", tier: "Pro", users: 24, patients: 1241, storage: "12 GB", region: "us-east-1", status: "active" as const },
  { id: "org_northpoint", name: "Northpoint Telecare", type: "Telemedicine", tier: "Basic", users: 8, patients: 412, storage: "1 GB", region: "eu-west-1", status: "trial" as const },
  { id: "org_greenleaf", name: "GreenLeaf Diagnostics", type: "Diagnostic", tier: "Enterprise", users: 41, patients: 8821, storage: "98 GB", region: "ap-south-1", status: "active" as const },
  { id: "org_bluepine", name: "Bluepine Pediatrics", type: "Clinic", tier: "Pro", users: 12, patients: 612, storage: "8 GB", region: "us-east-1", status: "active" as const },
  { id: "org_sunset", name: "Sunset Health", type: "Clinic", tier: "Basic", users: 5, patients: 89, storage: "0.4 GB", region: "ap-southeast-2", status: "suspended" as const },
];

const TIERS = ["Basic", "Pro", "Enterprise"] as const;
const TYPES = ["Clinic", "Hospital", "Telemedicine", "Diagnostic"] as const;
type Tier = typeof TIERS[number];
type TenantType = typeof TYPES[number];

export default function SuperTenants() {
  const [query, setQuery] = useState("");
  const [tierFilters, setTierFilters] = useState<Tier[]>([]);
  const [typeFilters, setTypeFilters] = useState<TenantType[]>([]);

  function toggleTier(t: Tier) {
    setTierFilters((curr) => (curr.includes(t) ? curr.filter((x) => x !== t) : [...curr, t]));
  }
  function toggleType(t: TenantType) {
    setTypeFilters((curr) => (curr.includes(t) ? curr.filter((x) => x !== t) : [...curr, t]));
  }
  function clearFilters() {
    setTierFilters([]);
    setTypeFilters([]);
  }

  const q = query.trim().toLowerCase();
  const filteredTenants = useMemo(
    () =>
      tenants.filter((t) => {
        if (tierFilters.length > 0 && !tierFilters.includes(t.tier as Tier)) return false;
        if (typeFilters.length > 0 && !typeFilters.includes(t.type as TenantType)) return false;
        if (q && !`${t.name} ${t.id} ${t.type} ${t.tier} ${t.region} ${t.status}`.toLowerCase().includes(q))
          return false;
        return true;
      }),
    [q, tierFilters, typeFilters],
  );

  const activeCount = tierFilters.length + typeFilters.length;

  return (
    <>
      <PageHeader
        eyebrow="Tenants"
        title="All organizations"
        description="Cross-tenant view. You can provision, configure, suspend, or reactivate — but cannot read tenant PHI without a break-glass session."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter /> Filter{activeCount > 0 ? ` · ${activeCount}` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Tier</DropdownMenuLabel>
                {TIERS.map((t) => (
                  <DropdownMenuItem key={t} onSelect={(e) => { e.preventDefault(); toggleTier(t); }}>
                    {tierFilters.includes(t) ? <Check className="size-3.5" /> : <span className="size-3.5" />} {t}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Type</DropdownMenuLabel>
                {TYPES.map((t) => (
                  <DropdownMenuItem key={t} onSelect={(e) => { e.preventDefault(); toggleType(t); }}>
                    {typeFilters.includes(t) ? <Check className="size-3.5" /> : <span className="size-3.5" />} {t}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={clearFilters}>Clear filters</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ActionButton size="sm" href="/super/tenants/new">
              <Plus /> Create New Tenant
            </ActionButton>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Active", value: 16, good: true },
          { label: "Trial", value: 1, warn: true },
          { label: "Suspended", value: 1 },
          { label: "Total users", value: "87,422" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.good ? "text-[var(--color-success)]" : s.warn ? "text-[var(--color-warning)]" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <Input
        placeholder="Search by tenant name, ID, or region…"
        leadingIcon={<Search />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="grid grid-cols-12 gap-4 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <div className="col-span-4">Tenant</div>
          <div className="col-span-2">Tier · Type</div>
          <div className="col-span-2">Region</div>
          <div className="col-span-1">Users</div>
          <div className="col-span-1">Storage</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        {filteredTenants.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">No tenants match the current filters.</p>
        ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {filteredTenants.map((t) => (
            <li key={t.id} className="grid grid-cols-12 items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-muted)]/40">
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.62_0.18_22)] to-[oklch(0.48_0.16_22)] text-white shadow-[var(--shadow-soft)] text-xs font-semibold">
                  {t.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{t.id}</p>
                </div>
              </div>
              <div className="col-span-2 space-y-0.5">
                <Badge variant="muted" size="sm">{t.tier}</Badge>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">{t.type}</p>
              </div>
              <div className="col-span-2 text-xs inline-flex items-center gap-1"><Globe className="size-3.5 text-[var(--color-muted-foreground)]" />{t.region}</div>
              <div className="col-span-1 text-xs tabular-nums"><Users className="mr-1 inline-block size-3.5 text-[var(--color-muted-foreground)]" />{t.users}</div>
              <div className="col-span-1 text-xs tabular-nums"><HardDrive className="mr-1 inline-block size-3.5 text-[var(--color-muted-foreground)]" />{t.storage}</div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                {t.status === "active" && <Badge variant="success" size="sm" dot>Active</Badge>}
                {t.status === "trial" && <Badge variant="warning" size="sm" dot>Trial</Badge>}
                {t.status === "suspended" && <Badge variant="danger" size="sm" dot>Suspended</Badge>}
                <TenantRowMenu tenant={t} />
              </div>
            </li>
          ))}
        </ul>
        )}
      </div>
    </>
  );
}
