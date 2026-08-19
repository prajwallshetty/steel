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

async function inspectVendors() {
  const vendors = await prisma.vendor.findMany({
    include: { branch: true },
  });

  console.log(`Found ${vendors.length} total vendors in DB (including soft-deleted):`);
  for (const v of vendors) {
    console.log(`- ID: ${v.id} | Name: "${v.name}" | Branch: ${v.branch.name} | DeletedAt: ${v.deletedAt ? v.deletedAt.toISOString() : "ACTIVE"}`);
  }
}

inspectVendors()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
