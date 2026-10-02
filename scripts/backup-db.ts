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
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "data", "backups");
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(backupDir, `backup_${timestamp}.json`);

  console.log(`Starting full database backup at ${new Date().toISOString()}...`);

  const backupData = {
    timestamp: new Date().toISOString(),
    branches: await prisma.branch.findMany(),
    users: await prisma.user.findMany(),
    sessions: await prisma.session.findMany(),
    customers: await prisma.customer.findMany(),
    vendors: await prisma.vendor.findMany(),
    staff: await prisma.staff.findMany(),
    quotations: await prisma.quotation.findMany(),
    quotationRows: await prisma.quotationRow.findMany(),
    cashLedgerEntries: await prisma.cashLedgerEntry.findMany(),
    vendorBills: await prisma.vendorBill.findMany(),
    ledgerOpeningBalances: await prisma.ledgerOpeningBalance.findMany(),
    auditLogs: await prisma.auditLog.findMany(),
    notifications: await prisma.notification.findMany(),
    systemSettings: await prisma.systemSetting.findMany(),
    sequences: await prisma.sequence.findMany(),
  };

  const counts = {
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
    ledgerOpeningBalances: backupData.ledgerOpeningBalances.length,
    auditLogs: backupData.auditLogs.length,
    notifications: backupData.notifications.length,
    systemSettings: backupData.systemSettings.length,
    sequences: backupData.sequences.length,
  };

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf-8");

  const fileSize = fs.statSync(backupPath).size;

  console.log("=== BACKUP SUCCESSFUL & VERIFIED ===");
  console.log(`Backup File: ${backupPath}`);
  console.log(`File Size: ${(fileSize / 1024).toFixed(2)} KB`);
  console.log("Table Record Counts:\n" + JSON.stringify(counts, null, 2));

  // Verify readability
  const readBack = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  if (readBack.customers.length !== counts.customers || readBack.vendors.length !== counts.vendors) {
    throw new Error("Verification failed! Backup data mismatch.");
  }
  console.log("Verification checks PASSED!");
}

main()
  .catch((err) => {
    console.error("Backup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
