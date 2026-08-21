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

async function main() {
  console.log("=== VERIFYING STAFF & CUSTOMER DATA ===");
  const activeCustomers = await prisma.customer.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  console.log(`Active Customers count: ${activeCustomers.length}`);
  let negSum = 0;
  for (const c of activeCustomers) {
    const bal = Number(c.garudaBalance);
    const dues = Number(c.currentDues);
    if (bal < 0 || dues > 0) {
      console.log(`  • ${c.name}: garudaBalance=${bal}, currentDues=${dues}`);
    }
    if (bal < 0) {
      negSum += Math.abs(bal);
    }
  }

  console.log(`\nSum of absolute values of negative garudaBalances: ₹${negSum.toLocaleString("en-IN")}`);
  console.log("=== VERIFICATION COMPLETED ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
