import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * The runtime database client.
 *
 * Connects through Neon's **pooled** endpoint (`DB_URL`). Serverless request
 * handlers open connections far faster than Postgres can retire them, so the
 * pooler is what keeps the instance from exhausting its connection limit.
 * Migrations take the direct endpoint instead — see `prisma.config.ts`.
 *
 * Cached on `globalThis` because Next's dev server re-evaluates modules on every
 * edit, and a fresh client per reload leaks a connection pool each time.
 */

const connectionString = process.env.DB_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DB_URL is not set. Add it to .env before starting the app.");
}

const globalForPrisma = globalThis as typeof globalThis & {
  __steelPrisma?: PrismaClient;
};

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.__steelPrisma ?? (globalForPrisma.__steelPrisma = createClient());

/**
 * Every business table is soft-deleted, so "still exists" is expressed once
 * here rather than repeated as a literal in each query.
 */
export const NOT_DELETED = { deletedAt: null } as const;
