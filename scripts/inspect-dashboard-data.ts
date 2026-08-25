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

async function inspectDashboardData() {
  console.log("=== INSPECTING BRANCHES AND BALANCES ===");

  const branches = await prisma.branch.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: {
          customers: true,
          vendors: true,
          quotations: true,
          ledgerEntries: true,
        },
      },
    },
  });

  for (const b of branches) {
    console.log(`Branch: ${b.name} (${b.code}) ID=${b.id}`);
    console.log(`  startingBalance: ${b.startingBalance}`);
    console.log(`  customers: ${b._count.customers}, vendors: ${b._count.vendors}, quotations: ${b._count.quotations}, ledger: ${b._count.ledgerEntries}`);
  }

  const openingBalances = await prisma.ledgerOpeningBalance.findMany({});
  console.log(`\nLedgerOpeningBalances count: ${openingBalances.length}`);
  for (const ob of openingBalances) {
    console.log(`  branchId: ${ob.branchId}, asOfDate: ${ob.asOfDate}, amount: ${ob.amount}`);
  }

  const allLedger = await prisma.cashLedgerEntry.findMany({});
  console.log(`\nCashLedgerEntry count: ${allLedger.length}`);
}

inspectDashboardData()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
