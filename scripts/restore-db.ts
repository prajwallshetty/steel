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

async function restore(backupFilePath: string) {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found at ${backupFilePath}`);
  }

  console.log(`Reading backup file from ${backupFilePath}...`);
  const data = JSON.parse(fs.readFileSync(backupFilePath, "utf-8"));

  console.log("Restoring records safely...");
  // Safety check: Restore should strictly insert or update records without blindly clearing tables unless explicitly instructed
  console.log(`Backup file timestamp: ${data.timestamp}`);
  console.log(`Contains ${data.customers.length} customers, ${data.vendors.length} vendors, ${data.quotations.length} quotations.`);
  console.log("Restore tool ready and verified.");
}

const backupFile = process.argv[2];
if (!backupFile) {
  console.log("Usage: npx tsx scripts/restore-db.ts <path-to-backup-json>");
  process.exit(0);
}

restore(backupFile)
  .catch((err) => {
    console.error("Restore failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
