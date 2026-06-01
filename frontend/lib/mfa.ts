/**
 * Lightweight TOTP wrapper used by the patient 2FA enrollment + sign-in
 * flows. Uses otplib v13's functional API:
 *  - generateSecret()    → base32 secret string
 *  - generateURI(args)   → otpauth:// URI for QR codes
 *  - verifySync(args)    → { valid, delta, epoch, timeStep } | { valid: false }
 *
 * Token: standard RFC 6238 TOTP, 30 s period, SHA-1, 6 digits.
 * Uses `epochTolerance: 1` to allow ±1 period (±30 s) of phone-clock drift —
 * matches what Google Authenticator users expect.
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
  // otplib v13: `verifySync` returns a discriminated union
  // `{ valid: true, delta, epoch, timeStep } | { valid: false }` — read `.valid`.
  // `epochTolerance: 1` means accept tokens from the previous, current, OR next
  // 30-s window (covers normal phone-clock drift). The library does the window
  // sweep internally; we used to do it ourselves with the (non-existent) `now`
  // option which was silently dropped.
  const result = verifySync({
    token: code,
    secret: args.secret,
    strategy: "totp",
    digits: DIGITS,
    period: PERIOD,
    epochTolerance: 1,
  });
  return !!(result && (result as { valid: boolean }).valid);
}
