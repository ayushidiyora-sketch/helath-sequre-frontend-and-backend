/**
 * Unified user lookup. Returns the first matching user from:
 *   1. Seeded demo users  (lib/demo-users.ts USERS array)
 *   2. Dynamic tenant users in memory  (lib/tenant-store.ts)
 *   3. The Postgres `users` table  (via Prisma)
 *
 * Source #3 carries a bcrypt hash; the login route must use bcrypt.compare()
 * for those. Sources #1 and #2 fall through to the password-store override +
 * DEMO_PASSWORD fallback the demo flow uses.
 */
import { RoleKind } from "@prisma/client";
import type { SessionClaims } from "@/lib/auth";
import type { LoginScope } from "@/lib/demo-users";
import { findDemoUser, findDemoUserByUid } from "@/lib/demo-users";
import { prisma } from "@/lib/prisma";

export interface LookedUpUser {
  uid: string;
  email: string;
  name: string;
  role: SessionClaims["role"];
  org: string | null; // org slug (e.g. "org_lakeside") for tenant users, null for super admin
  scope: LoginScope;
  source: "demo" | "database";
  passwordHash: string | null; // present for DB users; null for demo users
  status?: "active" | "invited" | "suspended" | "deactivated"; // DB users only
  /** Whether MFA / OTP is required on sign-in. Demo users default to true. */
  mfaRequired: boolean;
}

const ROLE_LABEL: Record<RoleKind, SessionClaims["role"]> = {
  patient: "Patient",
  clinician: "Clinician",
  org_admin: "Org Admin",
  compliance_manager: "Compliance Manager",
  auditor: "Auditor",
  super_admin: "Super Admin",
};

const ROLE_SCOPE: Record<RoleKind, LoginScope> = {
  patient: "patient",
  clinician: "staff",
  org_admin: "staff",
  compliance_manager: "staff",
  auditor: "staff",
  super_admin: "super",
};

type DbUserShape = Awaited<ReturnType<typeof loadDbUserByEmail>>;

async function loadDbUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { organization: { select: { slug: true } } },
  });
}

async function loadDbUserByUid(uid: string) {
  // DB uids are UUIDs; non-UUID values can't match, so short-circuit to avoid
  // a malformed-query error and a needless DB hit.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) {
    return null;
  }
  return prisma.user.findUnique({
    where: { id: uid },
    include: { organization: { select: { slug: true } } },
  });
}

function shapeDbUser(u: NonNullable<DbUserShape>): LookedUpUser {
  return {
    uid: u.id,
    email: u.email,
    name: `${u.firstName} ${u.lastName}`.trim(),
    role: ROLE_LABEL[u.roleKind],
    org: u.organization?.slug ?? null,
    scope: ROLE_SCOPE[u.roleKind],
    source: "database",
    passwordHash: u.passwordHash,
    status: u.status,
    mfaRequired: u.mfaRequired,
  };
}

export async function lookupUserByEmail(email: string): Promise<LookedUpUser | null> {
  const needle = email.trim().toLowerCase();

  // 1 + 2: seeded demo users and dynamic in-memory tenant users.
  const demo = findDemoUser(needle);
  if (demo) {
    return {
      uid: demo.uid,
      email: demo.email,
      name: demo.name,
      role: demo.role,
      org: demo.org,
      scope: demo.scope,
      source: "demo",
      passwordHash: null,
      // Demo users (super_admin / clinician / staff / patient) keep OTP on by
      // default since they're the auth-flow showcase.
      mfaRequired: true,
    };
  }

  // 3: Postgres.
  try {
    const dbUser = await loadDbUserByEmail(needle);
    if (dbUser && !dbUser.deletedAt) return shapeDbUser(dbUser);
  } catch (err) {
    console.error("[lookupUserByEmail] DB error:", err instanceof Error ? err.message : err);
  }
  return null;
}

export async function lookupUserByUid(uid: string): Promise<LookedUpUser | null> {
  const demo = findDemoUserByUid(uid);
  if (demo) {
    return {
      uid: demo.uid,
      email: demo.email,
      name: demo.name,
      role: demo.role,
      org: demo.org,
      scope: demo.scope,
      source: "demo",
      passwordHash: null,
      // Demo users (super_admin / clinician / staff / patient) keep OTP on by
      // default since they're the auth-flow showcase.
      mfaRequired: true,
    };
  }
  try {
    const dbUser = await loadDbUserByUid(uid);
    if (dbUser && !dbUser.deletedAt) return shapeDbUser(dbUser);
  } catch (err) {
    console.error("[lookupUserByUid] DB error:", err instanceof Error ? err.message : err);
  }
  return null;
}
