/**
 * Demo-only in-memory store for password overrides and used reset-token IDs.
 *
 * The base demo password lives in [lib/demo-users.ts](demo-users.ts). When a
 * user completes the "forgot password" flow we record their new password here
 * by uid; the login route checks the override before falling back to the demo
 * password. Resets the on process restart — this is acceptable for the demo.
 *
 * For a real backend, swap this for a Prisma table:
 *   model PasswordResetUsed { jti String @id, usedAt DateTime }
 *   model User { ..., passwordHash String }
 */
import { createHash, randomBytes } from "crypto";

// Pin singletons on globalThis so Next.js HMR + per-route module instances all
// share the same Map/Set. Without this, the reset-password route and the
// login route end up with separate stores in dev.
type Globals = typeof globalThis & {
  __hsPasswords?: Map<string, string>;
  __hsUsedJtis?: Set<string>;
  __hsOnboardCreds?: Map<string, string>; // jti -> plaintext temp password
};
const g = globalThis as Globals;
const passwords: Map<string, string> = (g.__hsPasswords ??= new Map());
const usedJtis: Set<string> = (g.__hsUsedJtis ??= new Set());
const onboardCreds: Map<string, string> = (g.__hsOnboardCreds ??= new Map());

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Store a new password for a user (replaces any previous override). */
export function setPassword(uid: string, password: string): void {
  passwords.set(uid, sha256(password));
}

/**
 * Returns true if `password` matches an override for this uid. Returns
 * `undefined` when no override exists — callers should fall back to the
 * demo password in that case.
 */
export function checkPassword(uid: string, password: string): boolean | undefined {
  const hash = passwords.get(uid);
  if (!hash) return undefined;
  return hash === sha256(password);
}

export function hasOverride(uid: string): boolean {
  return passwords.has(uid);
}

/** Mark a reset-token jti as used. Returns false if already used (replay). */
export function consumeJti(jti: string): boolean {
  if (usedJtis.has(jti)) return false;
  usedJtis.add(jti);
  return true;
}

/** Generate a random JWT id for a fresh reset token. */
export function newJti(): string {
  return randomBytes(12).toString("base64url");
}

/**
 * Stash the plaintext temp password for a newly-provisioned org admin so the
 * onboarding link can return it on first click. Deleted after first retrieval
 * (and any second click sees "expired"). The signed onboarding JWT separately
 * enforces a 7-day TTL via verifyOnboardToken().
 */
export function stashOnboardCred(jti: string, password: string): void {
  onboardCreds.set(jti, password);
}

/** Retrieve + delete the temp password for an onboarding jti. */
export function consumeOnboardCred(jti: string): string | undefined {
  const pw = onboardCreds.get(jti);
  if (pw === undefined) return undefined;
  onboardCreds.delete(jti);
  return pw;
}

/**
 * Password policy — kept loose for the demo but strong enough to be
 * meaningful (length + variety). Returns null when valid, otherwise a
 * short, user-facing reason.
 */
export function validatePassword(pw: string): string | null {
  if (pw.length < 12) return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(pw)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(pw)) return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(pw)) return "Password must include a digit.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must include a symbol.";
  return null;
}
