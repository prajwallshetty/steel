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

async function cleanOperationalData() {
  console.log("Starting operational data cleanup for Maharashtra-only scoping...");

  try {
    // 1. Delete Cash Ledger Entries
    const deletedLedger = await prisma.cashLedgerEntry.deleteMany({});
    console.log(`Deleted ${deletedLedger.count} CashLedgerEntry records.`);

    // 2. Delete Vendor Bills
    const deletedVendorBills = await prisma.vendorBill.deleteMany({});
    console.log(`Deleted ${deletedVendorBills.count} VendorBill records.`);

    // 3. Delete Ledger Opening Balances
    const deletedOpeningBalances = await prisma.ledgerOpeningBalance.deleteMany({});
    console.log(`Deleted ${deletedOpeningBalances.count} LedgerOpeningBalance records.`);

    // 4. Delete Quotation Rows
    const deletedQuotationRows = await prisma.quotationRow.deleteMany({});
    console.log(`Deleted ${deletedQuotationRows.count} QuotationRow records.`);

    // 5. Delete Quotations
    const deletedQuotations = await prisma.quotation.deleteMany({});
    console.log(`Deleted ${deletedQuotations.count} Quotation records.`);

    // 6. Identify Maharashtra Branch
    const maharashtraBranch = await prisma.branch.findUnique({
      where: { code: "MAH" },
    });

    if (!maharashtraBranch) {
      throw new Error("Maharashtra branch (MAH) not found in database!");
    }

    // 7. Delete Customers not belonging to Maharashtra branch
    const deletedCustomers = await prisma.customer.deleteMany({
      where: {
        branchId: { not: maharashtraBranch.id },
      },
    });
    console.log(`Deleted ${deletedCustomers.count} Customer records not in Maharashtra branch.`);

    // 8. Delete Vendors not belonging to Maharashtra branch
    const deletedVendors = await prisma.vendor.deleteMany({
      where: {
        branchId: { not: maharashtraBranch.id },
      },
    });
    console.log(`Deleted ${deletedVendors.count} Vendor records not in Maharashtra branch.`);

    // 9. Update remaining Maharashtra customers and vendors to have state = "Maharashtra"
    const updatedCustomers = await prisma.customer.updateMany({
      where: { branchId: maharashtraBranch.id },
      data: { state: "Maharashtra" },
    });
    console.log(`Updated state to 'Maharashtra' for ${updatedCustomers.count} customers.`);

    const updatedVendors = await prisma.vendor.updateMany({
      where: { branchId: maharashtraBranch.id },
      data: { state: "Maharashtra" },
    });
    console.log(`Updated state to 'Maharashtra' for ${updatedVendors.count} vendors.`);

    // 10. Reset Sequence Counters
    const resetSequences = await prisma.sequence.updateMany({
      data: { value: 0 },
    });
    console.log(`Reset ${resetSequences.count} sequence counters to 0.`);

    console.log("Operational data cleanup complete!");
  } catch (error) {
    console.error("Operational data cleanup failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanOperationalData();
