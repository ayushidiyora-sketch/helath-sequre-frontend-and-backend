/**
 * Demo-only in-memory store for tenants and the org-admin users that get
 * provisioned alongside them. Pinned on `globalThis` so Next.js HMR + per-route
 * module instances share state. Lost on process restart — fine for the demo.
 *
 * For a real backend, swap for Prisma:
 *   model Organization { id, name, type, tier, region, status, ... }
 *   model User         { ..., organizationId, roleKind }
 */
import type { DemoUser } from "@/lib/demo-users";

export type TenantStatus = "active" | "trial" | "suspended";
export type TenantTier = "Basic" | "Pro" | "Enterprise";
export type TenantType = "Clinic" | "Hospital" | "Telemedicine" | "Diagnostic";

export interface Tenant {
  id: string;
  name: string;
  type: TenantType;
  tier: TenantTier;
  region: string;
  status: TenantStatus;
  multiAz: boolean;
  s3Replication: boolean;
  adminUid: string;
  adminEmail: string;
  adminName: string;
  createdAt: string;
}

type Globals = typeof globalThis & {
  __hsTenants?: Map<string, Tenant>;
  __hsTenantUsers?: Map<string, DemoUser>; // keyed by uid
};
const g = globalThis as Globals;
const tenants: Map<string, Tenant> = (g.__hsTenants ??= new Map());
const tenantUsers: Map<string, DemoUser> = (g.__hsTenantUsers ??= new Map());

export function listTenants(): Tenant[] {
  return Array.from(tenants.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getTenant(id: string): Tenant | undefined {
  return tenants.get(id);
}

export function addTenant(t: Tenant): void {
  tenants.set(t.id, t);
}

export function addTenantUser(u: DemoUser): void {
  tenantUsers.set(u.uid, u);
}

export function findTenantUserByEmail(email: string): DemoUser | undefined {
  const needle = email.trim().toLowerCase();
  for (const u of tenantUsers.values()) {
    if (u.email === needle) return u;
  }
  return undefined;
}

export function findTenantUserByUid(uid: string): DemoUser | undefined {
  return tenantUsers.get(uid);
}

/** Slugify a tenant name into a lowercase tenant id like "org_lakeside_pediatrics". */
export function slugifyTenantId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return slug ? `org_${slug}` : `org_${Date.now().toString(36)}`;
}
