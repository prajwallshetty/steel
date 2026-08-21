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

async function testDashboardDirect() {
  console.log("=== TESTING DASHBOARD DIVISION METRICS DIRECTLY ===");

  const branches = await prisma.branch.findMany({
    where: { status: "ACTIVE", deletedAt: null },
  });

  for (const branch of branches) {
    const startingBalance = Number(branch.startingBalance ?? 0);

    const cashEntries = await prisma.cashLedgerEntry.findMany({
      where: {
        branchId: branch.id,
        status: { in: ["RECEIVED", "CLEARED"] },
        deletedAt: null,
      },
    });

    let creditSum = 0;
    let debitSum = 0;
    cashEntries.forEach((e) => {
      if (e.direction === "CREDIT") creditSum += Number(e.amount);
      else debitSum += Number(e.amount);
    });

    const openingBalance = startingBalance;
    const totalRevenue = creditSum;
    const totalExpenses = debitSum;
    const closingBalance = openingBalance + totalRevenue - totalExpenses;
    const cashInHand = closingBalance;

    console.log(`\nDivision: ${branch.name} (${branch.code})`);
    console.log(`  Starting Balance: ₹${startingBalance.toLocaleString("en-IN")}`);
    console.log(`  Opening Balance:  ₹${openingBalance.toLocaleString("en-IN")}`);
    console.log(`  Total Revenue:    +₹${totalRevenue.toLocaleString("en-IN")}`);
    console.log(`  Total Expenses:   -₹${totalExpenses.toLocaleString("en-IN")}`);
    console.log(`  Closing Balance:  ₹${closingBalance.toLocaleString("en-IN")}`);
    console.log(`  Cash in Hand:     ₹${cashInHand.toLocaleString("en-IN")}`);
  }

  const customerDues = await prisma.customer.aggregate({
    _sum: { currentDues: true },
    where: { deletedAt: null },
  });

  const vendorBalance = await prisma.vendor.aggregate({
    _sum: { balance: true },
    where: { deletedAt: null },
  });

  console.log("\n--- OVERALL FINANCIAL POSITION ---");
  console.log(`Customer Receivables: ₹${Number(customerDues._sum.currentDues ?? 0).toLocaleString("en-IN")}`);
  console.log(`Vendor Liabilities:   ₹${Number(vendorBalance._sum.balance ?? 0).toLocaleString("en-IN")}`);
}

testDashboardDirect()
  .catch((err) => {
    console.error("Dashboard test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
