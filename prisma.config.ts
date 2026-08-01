import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration (migrate, introspect, studio, seed).
 *
 * Migrations run against the DIRECT connection: they take PostgreSQL advisory
 * locks, which Neon's pgBouncer pooler does not support. The application's
 * runtime client uses the pooled URL instead — see `src/lib/database/prisma.ts`.
 */

/**
 * Prisma 7 does not load `.env` before evaluating this file, and the CLI is
 * often invoked without `--env-file`, so the values are read directly. Existing
 * `process.env` entries win, which keeps CI and container overrides working.
 */
function loadEnvFile(file = ".env"): void {
  let contents: string;
  try {
    contents = readFileSync(path.join(process.cwd(), file), "utf8");
  } catch {
    return; // No .env — rely on the ambient environment.
  }

  for (const line of contents.split("\n")) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["'](.*)["']$/, "$1");
  }
}

loadEnvFile();

const migrationUrl = process.env.DIRECT_DB_URL ?? process.env.DB_URL;

if (!migrationUrl) {
  throw new Error(
    "Set DB_URL (and ideally DIRECT_DB_URL) in .env before running Prisma commands.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: migrationUrl,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
