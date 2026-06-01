/**
 * Seeded demo accounts for the local dev flow. The credentials below match
 * the chips rendered on the patient, staff, and super-operator sign-in pages.
 * Production replaces these with database lookups against the User table.
 */
import type { SessionClaims } from "@/lib/auth";

export const DEMO_PASSWORD = "Demo!Pass1234";

export type LoginScope = "patient" | "staff" | "super";

export interface DemoUser {
  uid: string;
  email: string;
  name: string;
  role: SessionClaims["role"];
  org: string | null;
  scope: LoginScope;
}

const USERS: DemoUser[] = [
  {
    uid: "u_patient_ayushi",
    email: "ayushi.diyora@example.com",
    name: "Ayushi Diyora",
    role: "Patient",
    org: null,
    scope: "patient",
  },
  {
    uid: "u_clinician_priya",
    email: "priya.shah@citygeneral.health",
    name: "Dr. Priya Shah",
    role: "Clinician",
    org: "org_citygeneral",
    scope: "staff",
  },
  {
    uid: "u_admin_maya",
    email: "maya.iyer@citygeneral.health",
    name: "Maya Iyer",
    role: "Org Admin",
    org: "org_citygeneral",
    scope: "staff",
  },
  {
    uid: "u_compliance_citygen",
    email: "compliance@citygeneral.health",
    name: "Compliance Desk",
    role: "Compliance Manager",
    org: "org_citygeneral",
    scope: "staff",
  },
  {
    uid: "u_auditor_anand",
    email: "anand.verma@regulator.gov",
    name: "Anand Verma",
    role: "Auditor",
    org: null,
    scope: "staff",
  },
  {
    uid: "u_super_ayushi",
    email: "ayushi.diyora@sensussoft.com",
    name: "Ayushi Diyora",
    role: "Super Admin",
    org: null,
    scope: "super",
  },
];

/** Find a demo user by email (case-insensitive). Checks seeded users first, then dynamically-provisioned org admins. */
export function findDemoUser(email: string): DemoUser | undefined {
  const needle = email.trim().toLowerCase();
  const seeded = USERS.find((u) => u.email === needle);
  if (seeded) return seeded;
  // Lazy require to avoid a circular import at module init.
  const { findTenantUserByEmail } = require("./tenant-store") as typeof import("./tenant-store");
  return findTenantUserByEmail(needle);
}

/** Find a demo user by uid (used after the OTP step to rebuild claims). */
export function findDemoUserByUid(uid: string): DemoUser | undefined {
  const seeded = USERS.find((u) => u.uid === uid);
  if (seeded) return seeded;
  const { findTenantUserByUid } = require("./tenant-store") as typeof import("./tenant-store");
  return findTenantUserByUid(uid);
}

/** Build the SessionClaims to embed in `hs_session` for a demo user. */
export function claimsFor(user: DemoUser): SessionClaims {
  return {
    uid: user.uid,
    sid: `s_${user.uid}_${Date.now().toString(36)}`,
    role: user.role,
    org: user.org,
    name: user.name,
    email: user.email,
  };
}
