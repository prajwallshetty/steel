import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DB_URL ?? process.env.DATABASE_URL ?? process.env.DIRECT_DB_URL;

if (!connectionString) {
  throw new Error("DB_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log("=== RUNNING DATA INTEGRITY CHECKS ===");

  const backupDir = path.join(process.cwd(), "data", "backups");
  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    throw new Error("No backup files found for comparison.");
  }

  // Pick latest backup
  files.sort();
  const latestBackupFile = path.join(backupDir, files[files.length - 1]);
  console.log(`Comparing current database state against backup: ${latestBackupFile}`);

  const backupData = JSON.parse(fs.readFileSync(latestBackupFile, "utf-8"));

  const currentCounts = {
    branches: await prisma.branch.count(),
    users: await prisma.user.count(),
    sessions: await prisma.session.count(),
    customers: await prisma.customer.count(),
    vendors: await prisma.vendor.count(),
    staff: await prisma.staff.count(),
    quotations: await prisma.quotation.count(),
    quotationRows: await prisma.quotationRow.count(),
    cashLedgerEntries: await prisma.cashLedgerEntry.count(),
    vendorBills: await prisma.vendorBill.count(),
  };

  const backupCounts = {
    branches: backupData.branches.length,
    users: backupData.users.length,
    sessions: backupData.sessions.length,
    customers: backupData.customers.length,
    vendors: backupData.vendors.length,
    staff: backupData.staff.length,
    quotations: backupData.quotations.length,
    quotationRows: backupData.quotationRows.length,
    cashLedgerEntries: backupData.cashLedgerEntries.length,
    vendorBills: backupData.vendorBills.length,
  };

  console.log("Backup Record Counts:", backupCounts);
  console.log("Current Record Counts:", currentCounts);

  let passed = true;
  for (const [key, val] of Object.entries(backupCounts)) {
    if (key === "sessions") continue; // Sessions can naturally change
    const currVal = (currentCounts as any)[key];
    if (currVal < val) {
      console.error(`🚨 INTEGRITY ERROR: Table '${key}' record count decreased from ${val} to ${currVal}!`);
      passed = false;
    }
  }

  if (passed) {
    console.log("✅ DATA INTEGRITY VERIFICATION COMPLETED SUCCESSFULLY! No records lost.");
  } else {
    throw new Error("Data integrity verification failed!");
  }
}

main()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
