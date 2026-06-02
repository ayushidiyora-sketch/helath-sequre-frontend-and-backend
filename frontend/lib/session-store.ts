import { randomUUID } from "node:crypto";
import { signSession, type SessionClaims, isDbUid } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Issue a JWT session AND persist a `sessions` row so the user-facing
 * "Active sessions & devices" list on `/patient/settings → Sessions` can
 * surface and revoke real devices. The JWT remains the authoritative
 * authentication artifact — DB Session rows are presence/manageability
 * metadata.
 *
 *   - `sid` is a fresh UUID v4, shared between the JWT claims and the row id.
 *   - For non-DB demo users we still mint a JWT (so existing flows work) but
 *     skip the DB insert — there's no users.id to FK against.
 */
export interface IssueOpts {
  /** Used to fill `device`, `ipAddress`, `userAgent` columns. Pass the
   *  incoming Request. */
  req?: Request;
  /** TTL in hours. Defaults to 12 — matches `SESSION_TTL_HOURS` in auth.ts. */
  ttlHours?: number;
}

export async function issueSession(
  claims: Omit<SessionClaims, "sid">,
  opts: IssueOpts = {},
): Promise<{ jwt: string; sid: string }> {
  const sid = randomUUID();
  const jwt = await signSession({ ...claims, sid });
  if (isDbUid(claims.uid)) {
    const ttl = opts.ttlHours ?? 12;
    const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000);
    const userAgent = opts.req?.headers.get("user-agent") ?? null;
    const headerIp =
      opts.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      opts.req?.headers.get("x-real-ip") ||
      null;
    // In local dev (and behind proxies that don't forward), the header IP is
    // missing, ::1, 127.0.0.1, or a private RFC1918 range. In those cases
    // resolve the *outbound* public IP via api.ipify.org so the user sees a
    // real IP in their sessions list instead of a blank or "127.0.0.1".
    const ipAddress = isUsefulIp(headerIp) ? headerIp : await resolvePublicIp();
    const device = deriveDevice(userAgent);
    // refreshTokenHash is unique-required by the schema even though we don't
    // actually use refresh tokens — store the sid itself as the value.
    try {
      await prisma.$executeRaw`
        INSERT INTO sessions
          (id, "userId", "refreshTokenHash", device, "ipAddress", "userAgent",
           "issuedAt", "lastSeenAt", "expiresAt")
        VALUES
          (${sid}::uuid, ${claims.uid}::uuid, ${sid},
           ${device}, ${ipAddress}, ${userAgent},
           NOW(), NOW(), ${expiresAt})
      `;
    } catch (err) {
      // Never block sign-in on a presence-row insert failure.
      console.error("[session-store] failed to record session row:", err);
    }
  }
  return { jwt, sid };
}

function isUsefulIp(ip: string | null): boolean {
  if (!ip) return false;
  if (ip === "::1" || ip === "127.0.0.1" || ip === "localhost") return false;
  // RFC1918 private ranges + IPv6 link-local — these are LAN, not the real
  // public IP we want to show in the sessions list.
  if (/^10\./.test(ip)) return false;
  if (/^192\.168\./.test(ip)) return false;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return false;
  if (/^fe80:/i.test(ip)) return false;
  return true;
}

let _cachedPublicIp: { value: string | null; at: number } | null = null;
async function resolvePublicIp(): Promise<string | null> {
  // Cache for 10 minutes — login/register/verify-otp can all fire close
  // together and this saves the round-trip to ipify on every one.
  if (_cachedPublicIp && Date.now() - _cachedPublicIp.at < 10 * 60_000) {
    return _cachedPublicIp.value;
  }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch("https://api.ipify.org?format=json", { signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!r.ok) {
      _cachedPublicIp = { value: null, at: Date.now() };
      return null;
    }
    const data = (await r.json()) as { ip?: unknown };
    const ip = typeof data.ip === "string" ? data.ip : null;
    _cachedPublicIp = { value: ip, at: Date.now() };
    return ip;
  } catch {
    _cachedPublicIp = { value: null, at: Date.now() };
    return null;
  }
}

function deriveDevice(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os x") || ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("linux")) os = "Linux";
  let browser = "Browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/") && !ua.includes("edg/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari";
  return `${browser} · ${os}`;
}
