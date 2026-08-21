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
  const activeStaff = await prisma.staff.findMany({
    where: { deletedAt: null },
  });

  console.log(`Active Staff Members count: ${activeStaff.length}`);
  for (const s of activeStaff) {
    console.log(`  • Staff Name: ${s.name} | Balance: ₹${Number(s.balance).toLocaleString("en-IN")}`);
  }

  const activeCustomersCount = await prisma.customer.count({
    where: { deletedAt: null },
  });

  const customerDues = await prisma.customer.aggregate({
    where: { deletedAt: null },
    _sum: { currentDues: true },
  });

  console.log(`Active Customers count: ${activeCustomersCount}`);
  console.log(`Total Active Customer Dues: ₹${Number(customerDues._sum.currentDues ?? 0).toLocaleString("en-IN")}`);
  console.log("=== VERIFICATION COMPLETED ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
