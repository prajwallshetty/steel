import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnv(): void {
  try {
    const contents = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of contents.split("\n")) {
      const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!match) continue;
      const [, key, raw] = match;
      if (process.env[key] === undefined) {
        process.env[key] = raw.trim().replace(/^["'](.*)["']$/, "$1");
      }
    }
  } catch {
    /* rely on ambient environment */
  }
}

loadEnv();

const connectionString = process.env.DB_URL;
if (!connectionString) {
  console.error("Error: DB_URL is not set.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function migrateCustomerSchema() {
  console.log("Migrating customer database schema via PrismaPg driver adapter...");

  try {
    // Add garudaBalance column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "garudaBalance" DECIMAL(16,2) DEFAULT 0 NOT NULL;
    `);
    console.log("✓ Added 'garudaBalance' column to customers table.");

    // Add currentDues column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "currentDues" DECIMAL(16,2) DEFAULT 0 NOT NULL;
    `);
    console.log("✓ Added 'currentDues' column to customers table.");

    // Drop unique constraint on (branchId, name) if it exists
    await prisma.$executeRawUnsafe(`
      DROP INDEX IF EXISTS "customers_branchId_name_key";
    `);
    console.log("✓ Dropped legacy unique index customers_branchId_name_key.");

    // Create index on (branchId, name)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "customers_branchId_name_idx" ON "customers"("branchId", "name");
    `);
    console.log("✓ Created index customers_branchId_name_idx.");

    console.log("Database schema migration complete!");
  } catch (error) {
    console.error("Schema migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateCustomerSchema();
