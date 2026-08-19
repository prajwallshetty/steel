import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
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
  console.log("Starting operational data cleanup and user password reset...");

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

    // 6. Delete Customers
    const deletedCustomers = await prisma.customer.deleteMany({});
    console.log(`Deleted ${deletedCustomers.count} Customer records.`);

    // 7. Delete Vendors
    const deletedVendors = await prisma.vendor.deleteMany({});
    console.log(`Deleted ${deletedVendors.count} Vendor records.`);

    // 8. Reset Sequence Counters
    const resetSequences = await prisma.sequence.updateMany({
      data: { value: 0 },
    });
    console.log(`Reset ${resetSequences.count} sequence counters to 0.`);

    // 9. Reset All User Passwords to "Branch@2026"
    const newPasswordHash = await bcrypt.hash("Branch@2026", 12);
    const updatedUsers = await prisma.user.updateMany({
      data: {
        passwordHash: newPasswordHash,
      },
    });
    console.log(`Reset password to 'Branch@2026' for ${updatedUsers.count} users across all branches and roles.`);

    console.log("Operational data cleanup & password reset complete!");
  } catch (error) {
    console.error("Operational data cleanup failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanOperationalData();
