import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getCustomerLedger, getVendorLedger } from "../src/modules/receipt-payment/receipt-service";

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

async function verifyLedgers() {
  console.log("=== VERIFYING SEEDED DATA LEDGERS ===");

  const superAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });
  if (!superAdmin) throw new Error("No super admin found");

  const user = {
    id: superAdmin.id,
    role: superAdmin.role,
    branchId: null,
  };

  // 1. Verify Customer Ledger (e.g. AAI ENTERPRISES and GANESH STEEL)
  const aai = await prisma.customer.findFirst({ where: { name: "AAI ENTERPRISES" } });
  if (aai) {
    const ledger = await getCustomerLedger(user, aai.id);
    console.log(`\n--- CUSTOMER LEDGER: ${ledger.customerName} ---`);
    console.log(`Opening Balance: ₹${ledger.openingBalance.toLocaleString("en-IN")}`);
    console.log(`Closing Balance: ₹${ledger.closingBalance.toLocaleString("en-IN")}`);
    console.log(`Total Rows:      ${ledger.rows.length}`);
  }

  const ganesh = await prisma.customer.findFirst({ where: { name: { contains: "GANESH STEEL" } } });
  if (ganesh) {
    const ledger = await getCustomerLedger(user, ganesh.id);
    console.log(`\n--- CUSTOMER LEDGER: ${ledger.customerName} ---`);
    console.log(`Opening Balance: ₹${ledger.openingBalance.toLocaleString("en-IN")}`);
    console.log(`Closing Balance: ₹${ledger.closingBalance.toLocaleString("en-IN")}`);
  }

  // 2. Verify Vendor Ledger (e.g. ARYA STEEL and SHREEJI STEEL CENTER)
  const arya = await prisma.vendor.findFirst({ where: { name: "ARYA STEEL" } });
  if (arya) {
    const ledger = await getVendorLedger(user, arya.id);
    console.log(`\n--- VENDOR LEDGER: ${ledger.vendorName} ---`);
    console.log(`Opening Balance: ₹${ledger.openingBalance.toLocaleString("en-IN")}`);
    console.log(`Closing Balance: ₹${ledger.closingBalance.toLocaleString("en-IN")}`);
  }

  const shreeji = await prisma.vendor.findFirst({ where: { name: "SHREEJI STEEL CENTER" } });
  if (shreeji) {
    const ledger = await getVendorLedger(user, shreeji.id);
    console.log(`\n--- VENDOR LEDGER: ${ledger.vendorName} ---`);
    console.log(`Opening Balance: ₹${ledger.openingBalance.toLocaleString("en-IN")}`);
    console.log(`Closing Balance: ₹${ledger.closingBalance.toLocaleString("en-IN")}`);
  }

  // 3. Count total CashLedgerEntry opening balance entries
  const totalEntries = await prisma.cashLedgerEntry.count({
    where: { particular: { contains: "Opening" } },
  });
  console.log(`\nTotal Seeded Opening Balance Ledger Entries in DB: ${totalEntries}`);
}

verifyLedgers()
  .catch((err) => {
    console.error("Ledger verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
