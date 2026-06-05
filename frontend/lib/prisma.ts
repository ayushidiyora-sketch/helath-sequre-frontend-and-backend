/**
 * Prisma singleton with **dual-write fan-out**.
 *
 * Reads always come from the primary (NEON_DATABASE_URL). Writes — both typed
 * client (`prisma.user.create(...)`, etc.) AND raw mutations (`$executeRaw`,
 * `$queryRaw` with INSERT/UPDATE/DELETE/UPSERT) — fan out to a shadow client
 * pointed at POSTGRES_DATABASE_URL. If the shadow write fails we log a
 * warning and the primary's result is still returned to the caller.
 *
 * Caveats — must read before relying on this in production:
 *   1. UUIDs generated via `gen_random_uuid()` or Prisma `@default(uuid())`
 *      DIVERGE between the two DBs because each Postgres rolls its own. The
 *      same logical record exists on both, but its id column differs.
 *      Foreign keys built off such ids only resolve on the originating DB.
 *   2. Auto-increment columns (e.g. `incidents.number`) diverge similarly.
 *   3. There is NO cross-DB transaction. If the primary write succeeds and
 *      the shadow write fails, the two are out of sync until you reconcile.
 *   4. Reads never go to the shadow. If you query the shadow directly and
 *      it's behind, you'll get stale data.
 *
 * Disable dual-write by either:
 *   - Removing POSTGRES_DATABASE_URL from .env.local
 *   - Setting POSTGRES_DATABASE_URL equal to NEON_DATABASE_URL
 * In both cases the helper degrades to single-client mode.
 *
 * Only import from `runtime = "nodejs"` route handlers, server components, or
 * server actions. Importing into the Edge runtime or client code will fail at
 * build time (Prisma needs Node).
 */
import { Prisma, PrismaClient } from "@prisma/client";

type Globals = typeof globalThis & {
  __hsPrismaPrimary?: PrismaClient;
  __hsPrismaShadow?: PrismaClient | null;
};
const g = globalThis as Globals;

function primaryUrl(): string | undefined {
  return process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
}
function shadowUrl(): string | undefined {
  const url = process.env.POSTGRES_DATABASE_URL;
  if (!url) return undefined;
  if (url === primaryUrl()) return undefined; // same DB → no fan-out
  return url;
}

function makeClient(url: string | undefined): PrismaClient {
  return new PrismaClient({
    log: ["error", "warn"],
    ...(url ? { datasourceUrl: url } : {}),
  });
}

const primary: PrismaClient = g.__hsPrismaPrimary ?? makeClient(primaryUrl());
const shadow: PrismaClient | null =
  g.__hsPrismaShadow !== undefined
    ? g.__hsPrismaShadow
    : shadowUrl()
      ? makeClient(shadowUrl())
      : null;

if (process.env.NODE_ENV !== "production") {
  g.__hsPrismaPrimary = primary;
  g.__hsPrismaShadow = shadow;
}

// Set of typed-client actions that mutate state. Used by the $use middleware
// below to decide when to fan-out to the shadow.
//
// Note: Prisma's $use middleware does NOT intercept the *Unsafe variants
// (`$executeRawUnsafe`, `$queryRawUnsafe`). Those bypass middleware entirely
// — any call site that uses them only writes to the primary. All of our
// recent code uses the safe template-literal forms (`$executeRaw` /
// `$queryRaw`), so this set covers the actual mutations we care about.
const WRITE_ACTIONS: ReadonlySet<string> = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "executeRaw",
  "queryRaw",
]);

// Detect mutations inside raw SQL. Conservative — any of these keywords in
// the leading section of the statement triggers fan-out. Avoids replaying
// pure SELECTs against the shadow (wasted work + noisy on offline shadow).
function rawIsMutation(args: unknown): boolean {
  // For tagged-template raw queries Prisma passes a `Sql` value as args[0].
  // For *Unsafe variants the first arg is a plain string. Look at both.
  const first = Array.isArray(args) ? args[0] : args;
  let sql = "";
  if (typeof first === "string") sql = first;
  else if (first && typeof first === "object" && "text" in first) {
    sql = String((first as { text?: unknown }).text ?? "");
  } else if (first && typeof first === "object" && "strings" in first) {
    const ss = (first as { strings?: unknown }).strings;
    if (Array.isArray(ss)) sql = ss.join(" ");
  }
  return /\b(INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|ALTER|DROP|CREATE)\b/i.test(sql);
}

// Replay a typed-client write on the shadow. Best-effort — swallows errors
// after logging. Returns nothing — the primary's result is what the caller
// gets back.
async function fanOutTyped(
  client: PrismaClient,
  modelName: string,
  action: string,
  args: unknown,
): Promise<void> {
  const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const delegate = (client as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[modelKey];
  const fn = delegate?.[action];
  if (typeof fn !== "function") {
    console.warn(`[prisma:shadow] no delegate for ${modelKey}.${action} — skipping`);
    return;
  }
  await fn.call(delegate, args);
}

// Replay a raw write on the shadow. Only the safe template-literal variants
// reach this — *Unsafe forms bypass Prisma middleware entirely.
async function fanOutRaw(
  client: PrismaClient,
  action: "executeRaw" | "queryRaw",
  args: unknown,
): Promise<void> {
  const argsArr = Array.isArray(args) ? args : [args];
  const sql = argsArr[0] as Prisma.Sql;
  if (action === "executeRaw") {
    await client.$executeRaw(sql);
  } else {
    await client.$queryRaw(sql);
  }
}

// Install the fan-out middleware on the primary. Each request to the primary
// runs FIRST against primary (so the caller gets the canonical result), THEN
// the same logical operation runs against the shadow.
if (shadow && !g.__hsPrismaPrimary) {
  primary.$use(async (params, next) => {
    const result = await next(params);
    if (!shadow) return result;
    if (!WRITE_ACTIONS.has(params.action)) return result;

    // For raw queries: only fan out if the SQL actually mutates. SELECT-only
    // raw reads stay on the primary so we don't spam the shadow.
    const isRaw =
      params.action === "executeRaw" || params.action === "queryRaw";
    if (isRaw && !rawIsMutation(params.args)) return result;

    try {
      if (isRaw) {
        await fanOutRaw(shadow, params.action as "executeRaw" | "queryRaw", params.args);
      } else if (params.model) {
        await fanOutTyped(shadow, params.model, params.action, params.args);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[prisma:shadow] ${params.model ?? "$raw"}.${params.action} failed — primary write OK, shadow drift: ${msg.slice(0, 200)}`,
      );
    }

    return result;
  });
}

export const prisma: PrismaClient = primary;

// Exported for tests / one-off scripts that need to inspect / clean the shadow.
export const prismaShadow: PrismaClient | null = shadow;
