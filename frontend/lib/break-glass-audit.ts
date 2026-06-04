import { prisma } from "@/lib/prisma";
import { isDbUid, type SessionClaims } from "@/lib/auth";

/**
 * Returns the active break-glass session for a Super Admin operator targeting
 * a specific tenant, or null. Read-only helper — never throws (returns null
 * on any DB error so PHI routes still work if the table is missing or the
 * caller isn't a Super Admin).
 *
 * Pass either `operatorEmail` (preferred for demo accounts whose `claims.uid`
 * is a non-UUID seed string) or `operatorId` (real DB users).
 */
export async function getActiveBreakGlassSession(args: {
  operatorEmail: string;
  operatorUid?: string;
  targetOrgId: string;
}): Promise<{ id: string; displayId: string; incidentRef: string | null } | null> {
  try {
    if (args.operatorUid && isDbUid(args.operatorUid)) {
      const rows = await prisma.$queryRaw<
        { id: string; displayId: string; incidentRef: string | null }[]
      >`
        SELECT id, "displayId", "incidentRef"
        FROM break_glass_sessions
        WHERE status = 'active'
          AND "expiresAt" > NOW()
          AND "operatorId" = ${args.operatorUid}::uuid
          AND "targetOrgId" = ${args.targetOrgId}::uuid
        ORDER BY "startedAt" DESC
        LIMIT 1
      `;
      if (rows[0]) return rows[0];
    }
    // Fallback: match by operatorEmail. Covers demo Super Admins whose
    // SessionClaims.uid is a seed string but who still have a real DB
    // user row that the break_glass_sessions table FKs against.
    const rows = await prisma.$queryRaw<
      { id: string; displayId: string; incidentRef: string | null }[]
    >`
      SELECT id, "displayId", "incidentRef"
      FROM break_glass_sessions
      WHERE status = 'active'
        AND "expiresAt" > NOW()
        AND LOWER("operatorEmail") = ${args.operatorEmail.trim().toLowerCase()}
        AND "targetOrgId" = ${args.targetOrgId}::uuid
      ORDER BY "startedAt" DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Log a tenant-scoped read in `break_glass_reads` so the audit transcript can
 * show what the Super Admin actually accessed during the elevation window.
 *
 * Call this from any tenant-scoped read route AFTER you've decided to return
 * PHI data to a Super Admin operator. No-op if there's no active break-glass
 * session (the caller is a normal CM / Auditor / Org Admin and shouldn't tag).
 */
export async function tagBreakGlassRead(args: {
  claims: SessionClaims;
  targetOrgId: string;
  endpoint: string;
  queryParams?: string;
  recordCount: number;
}): Promise<void> {
  if (args.claims.role !== "Super Admin") return;
  try {
    const session = await getActiveBreakGlassSession({
      operatorEmail: args.claims.email,
      operatorUid: args.claims.uid,
      targetOrgId: args.targetOrgId,
    });
    if (!session) return;

    // Resolve the operator UUID + email for the row. The session row already
    // has both, but we still need a valid users.id FK for the new row.
    const [op] = await prisma.$queryRaw<{ id: string; email: string }[]>`
      SELECT u.id, u.email
      FROM users u
      WHERE LOWER(u.email) = ${args.claims.email.trim().toLowerCase()}
      LIMIT 1
    `;
    if (!op) return; // demo user without a real row — can't FK, skip silently

    await prisma.$executeRaw`
      INSERT INTO break_glass_reads (
        "sessionId", "operatorId", "operatorEmail",
        "targetOrgId", endpoint, "queryParams", "recordCount", "readAt"
      ) VALUES (
        ${session.id}::uuid, ${op.id}::uuid, ${op.email},
        ${args.targetOrgId}::uuid, ${args.endpoint},
        ${args.queryParams ?? null}, ${args.recordCount}, NOW()
      )
    `;
  } catch (err) {
    console.error("[break-glass-audit] tag failed:", err);
  }
}
