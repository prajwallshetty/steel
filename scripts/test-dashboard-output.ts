import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getDashboardMetrics } from "../src/modules/dashboard/dashboard-service";

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

async function testDashboard() {
  console.log("=== TESTING DASHBOARD METRICS OUTPUT ===");

  const users = await prisma.user.findMany({
    include: { branch: true },
  });

  const superAdmin = users.find((u) => u.role === "SUPER_ADMIN");
  if (!superAdmin) throw new Error("No super admin found");

  const metrics = await getDashboardMetrics(superAdmin);

  console.log("\n--- SUPER ADMIN DASHBOARD METRICS ---");
  console.log(`Cash in Hand / Balance: ₹${metrics.cashBalance.toLocaleString("en-IN")}`);
  console.log(`Customer Receivables:   ₹${metrics.outstandingReceivables.toLocaleString("en-IN")}`);
  console.log(`Vendor Liabilities:     ₹${metrics.outstandingPayables.toLocaleString("en-IN")}`);
  console.log(`Total Customers:        ${metrics.totalCustomers}`);
  console.log(`Total Vendors:          ${metrics.totalVendors}`);
  console.log(`Today's Incoming:       ₹${metrics.receiptsToday.toLocaleString("en-IN")}`);
  console.log(`Today's Outgoing:       ₹${metrics.paymentsToday.toLocaleString("en-IN")}`);

  console.log("\n--- DIVISIONS FINANCIAL OVERVIEW ---");
  for (const div of metrics.divisionFinancials) {
    console.log(`Division: ${div.name} (${div.code})`);
    console.log(`  Opening Balance: ₹${div.openingBalance.toLocaleString("en-IN")}`);
    console.log(`  Total Revenue:   ₹${div.totalRevenue.toLocaleString("en-IN")}`);
    console.log(`  Total Expenses:  ₹${div.totalExpenses.toLocaleString("en-IN")}`);
    console.log(`  Closing Balance: ₹${div.closingBalance.toLocaleString("en-IN")}`);
    console.log(`  Cash in Hand:    ₹${div.cashInHand.toLocaleString("en-IN")}`);
  }

  console.log("\n--- OVERALL COMBINED SUMMARY ---");
  console.log(`Total Closing Balance: ₹${metrics.overallFinancials.totalClosingBalance.toLocaleString("en-IN")}`);
  console.log(`Total Cash in Hand:    ₹${metrics.overallFinancials.totalCashInHand.toLocaleString("en-IN")}`);

  // Test Mangalore Manager
  const mngBranch = await prisma.branch.findFirst({ where: { code: "MNG" } });
  if (mngBranch) {
    const mngUser = {
      id: "test-mng",
      role: "BRANCH_ADMIN" as const,
      branchId: mngBranch.id,
      email: "mng@example.com",
    };
    const mngMetrics = await getDashboardMetrics(mngUser);
    console.log("\n--- MANGALORE BRANCH ADMIN METRICS ---");
    console.log(`Cash in Hand / Balance: ₹${mngMetrics.cashBalance.toLocaleString("en-IN")}`);
    console.log(`Customer Receivables:   ₹${mngMetrics.outstandingReceivables.toLocaleString("en-IN")}`);
    console.log(`Vendor Liabilities:     ₹${mngMetrics.outstandingPayables.toLocaleString("en-IN")}`);
    console.log(`Total Customers:        ${mngMetrics.totalCustomers}`);
    console.log(`Total Vendors:          ${mngMetrics.totalVendors}`);
  }
}

testDashboard()
  .catch((err) => {
    console.error("Dashboard test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
