import { prisma } from "@/lib/prisma";
import { isDbUid } from "@/lib/auth";

/**
 * Frontend-side mirror of the OTP/MFA flow into the `mfa_challenges` table.
 *
 * The OTP itself lives in the `hs_pending` JWT cookie — that cookie is the
 * source of truth for "is this code correct? how many attempts remain?". This
 * store exists in parallel only so the compliance/audit surfaces (the Failed
 * MFA anomaly detector at `/api/compliance/anomalies` + the audit ledger UNION
 * at `/api/compliance/audit-logs`) have rows to read from. Demo users have
 * non-UUID `uid` values so every helper short-circuits via `isDbUid` to keep
 * the demo path 100 % free of DB writes.
 *
 * Detector contract:
 *   - `attemptsLeft = 0 AND usedAt IS NULL` → exhausted failure (flagged)
 *   - `usedAt IS NOT NULL`                  → successfully verified (ignored)
 *   - anything else                          → in-flight (ignored)
 */

interface IssuedInput {
  uid: string;
  otpHash: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordChallengeIssued(input: IssuedInput): Promise<void> {
  if (!isDbUid(input.uid)) return;
  try {
    // Revoke any prior unused challenges for this user — there's only ever
    // one in-flight challenge per session, so anything older is stale.
    await prisma.$executeRaw`
      UPDATE mfa_challenges
      SET "attemptsLeft" = 0, "usedAt" = NOW()
      WHERE "userId" = ${input.uid}::uuid
        AND "usedAt" IS NULL
        AND "attemptsLeft" > 0
    `;
    await prisma.$executeRaw`
      INSERT INTO mfa_challenges
        (id, "userId", "codeHash", "attemptsLeft", "issuedAt", "expiresAt",
         "ipAddress", "userAgent")
      VALUES
        (gen_random_uuid(), ${input.uid}::uuid, ${input.otpHash}, 5,
         NOW(), ${input.expiresAt},
         ${input.ipAddress ?? null}, ${input.userAgent ?? null})
    `;
  } catch (err) {
    // Auth must keep working even if the audit mirror has a hiccup.
    console.error("[mfa-challenge-store] recordChallengeIssued failed:", err);
  }
}

export async function recordChallengeAttempt(uid: string): Promise<void> {
  if (!isDbUid(uid)) return;
  try {
    await prisma.$executeRaw`
      UPDATE mfa_challenges
      SET "attemptsLeft" = GREATEST(0, "attemptsLeft" - 1)
      WHERE id = (
        SELECT id FROM mfa_challenges
        WHERE "userId" = ${uid}::uuid
          AND "usedAt" IS NULL
        ORDER BY "issuedAt" DESC
        LIMIT 1
      )
    `;
  } catch (err) {
    console.error("[mfa-challenge-store] recordChallengeAttempt failed:", err);
  }
}

/**
 * Force the latest unused row to `attemptsLeft = 0` — used when the cookie
 * counter says we've hit `MAX_OTP_ATTEMPTS`. Keeps the DB row consistent with
 * the cookie even if a couple of decrements were lost (e.g. parallel calls).
 */
export async function recordChallengeExhausted(uid: string): Promise<void> {
  if (!isDbUid(uid)) return;
  try {
    await prisma.$executeRaw`
      UPDATE mfa_challenges
      SET "attemptsLeft" = 0
      WHERE id = (
        SELECT id FROM mfa_challenges
        WHERE "userId" = ${uid}::uuid
          AND "usedAt" IS NULL
        ORDER BY "issuedAt" DESC
        LIMIT 1
      )
    `;
  } catch (err) {
    console.error("[mfa-challenge-store] recordChallengeExhausted failed:", err);
  }
}

export async function recordChallengeUsed(uid: string): Promise<void> {
  if (!isDbUid(uid)) return;
  try {
    await prisma.$executeRaw`
      UPDATE mfa_challenges
      SET "usedAt" = NOW()
      WHERE id = (
        SELECT id FROM mfa_challenges
        WHERE "userId" = ${uid}::uuid
          AND "usedAt" IS NULL
        ORDER BY "issuedAt" DESC
        LIMIT 1
      )
    `;
  } catch (err) {
    console.error("[mfa-challenge-store] recordChallengeUsed failed:", err);
  }
}
