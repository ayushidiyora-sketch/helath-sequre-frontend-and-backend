/**
 * Prisma singleton — survives Next.js HMR by stashing the client on globalThis.
 * Without this each route handler reload would open a fresh DB connection pool.
 *
 * Only import from `runtime = "nodejs"` route handlers, server components, or
 * server actions. Importing into the Edge runtime or client code will fail at
 * build time (Prisma needs Node).
 */
import { PrismaClient } from "@prisma/client";

type Globals = typeof globalThis & {
  __hsPrisma?: PrismaClient;
};
const g = globalThis as Globals;

export const prisma: PrismaClient =
  g.__hsPrisma ?? new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") {
  g.__hsPrisma = prisma;
}
