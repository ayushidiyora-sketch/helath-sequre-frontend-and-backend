/**
 * Edge-safe auth helpers — JWT session cookies + role routing.
 *
 * This module is imported by `middleware.ts` (Edge runtime), so it MUST NOT
 * import Prisma or bcrypt. Password hashing lives in the API routes; this file
 * only signs/verifies the stateless session JWT and maps roles to routes.
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "hs_session";
const SESSION_TTL_HOURS = 12;

/** Claims embedded in the signed session cookie. */
export interface SessionClaims {
  uid: string; // user id
  sid: string; // session row id
  role: string; // role name, e.g. "Clinician"
  org: string | null; // organization id (null for Super Admin)
  name: string; // display name
  email: string;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (s) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not set — add it to .env");
  }
  // Dev fallback so the demo flow (register → verify → dashboard) works out of
  // the box. Production builds still require an explicit AUTH_SECRET above.
  return new TextEncoder().encode("dev-only-insecure-secret-do-not-use-in-prod");
}

/** Sign a session JWT valid for 12 hours. */
export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(secret());
}

/** Verify a session JWT. Returns null on any failure (expired, tampered, missing). */
export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      uid: String(payload.uid),
      sid: String(payload.sid),
      role: String(payload.role),
      org: payload.org == null ? null : String(payload.org),
      name: String(payload.name),
      email: String(payload.email),
    };
  } catch {
    return null;
  }
}

/** Session lifetime in seconds — used for the cookie Max-Age. */
export const SESSION_MAX_AGE = SESSION_TTL_HOURS * 60 * 60;

// ---------------------------------------------------------------------------
// Pending OTP challenge — the short-lived state between password and OTP steps
// ---------------------------------------------------------------------------

export const PENDING_COOKIE = "hs_pending";
export const OTP_TTL_SECONDS = 10 * 60; // OTP valid for 10 minutes
export const MAX_OTP_ATTEMPTS = 5;

/** Claims carried in the `hs_pending` cookie while awaiting OTP entry. */
export interface PendingClaims {
  uid: string; // user id that passed the password step
  otpHash: string; // sha256 of the 6-digit code
  attempts: number; // wrong-code attempts so far
}

/** Sign a short-lived pending-auth JWT (10 min). */
export async function signPending(claims: PendingClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OTP_TTL_SECONDS}s`)
    .sign(secret());
}

/** Verify the pending-auth JWT. Returns null on any failure (expired, tampered). */
export async function verifyPending(token: string | undefined): Promise<PendingClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      uid: String(payload.uid),
      otpHash: String(payload.otpHash),
      attempts: Number(payload.attempts ?? 0),
    };
  } catch {
    return null;
  }
}

/** Maps each role to the URL prefix it owns. */
export const ROLE_PREFIX: Record<string, string> = {
  Patient: "/patient",
  Clinician: "/clinician",
  "Org Admin": "/admin",
  "Compliance Manager": "/compliance",
  Auditor: "/auditor",
  "Super Admin": "/super",
};

/** Landing route for a role after login. */
export function roleHome(role: string): string {
  const prefix = ROLE_PREFIX[role];
  return prefix ? `${prefix}/dashboard` : "/login";
}
