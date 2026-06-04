/**
 * Lightweight TOTP wrapper used by the patient 2FA enrollment + sign-in
 * flows. Uses otplib v13's functional API:
 *  - generateSecret()    → base32 secret string
 *  - generateURI(args)   → otpauth:// URI for QR codes
 *  - verifySync(args)    → { valid, delta, epoch, timeStep } | { valid: false }
 *
 * Token: standard RFC 6238 TOTP, 30 s period, SHA-1, 6 digits.
 * Uses `epochTolerance: 30` (SECONDS, not periods) to allow ±30 s of
 * phone-clock drift — matches Google Authenticator UX.
 */
import { generateSecret, generateURI, verifySync } from "otplib";

const ISSUER = "HealthSecure Portal";
const PERIOD = 30;
const DIGITS = 6;

export function newSecret(): string {
  return generateSecret();
}

export function buildOtpAuthUri(args: { email: string; secret: string }): string {
  // otplib v13: the strategy key is `strategy`, NOT `type`. With `type` the
  // option was silently ignored and the URI was built with library defaults.
  return generateURI({
    strategy: "totp",
    label: args.email,
    issuer: ISSUER,
    secret: args.secret,
    digits: DIGITS,
    period: PERIOD,
  });
}

export function verifyToken(args: { token: string; secret: string }): boolean {
  const code = args.token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  // otplib v13: `verifySync` returns `{ valid, delta, epoch, timeStep } |
  // { valid: false }`. `epochTolerance` is in SECONDS (not periods) — passing
  // `1` rejected every legitimate code unless the phone & server clocks agreed
  // to the same second. `30` gives ±30 s of drift, the standard 2FA tolerance.
  const result = verifySync({
    token: code,
    secret: args.secret,
    strategy: "totp",
    digits: DIGITS,
    period: PERIOD,
    epochTolerance: 30,
  });
  return !!(result && (result as { valid: boolean }).valid);
}
