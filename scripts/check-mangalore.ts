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

async function checkMangalore() {
  const mng = await prisma.branch.findFirst({ where: { code: "MNG" } });
  if (!mng) {
    console.log("No MNG branch found");
    return;
  }
  console.log("Mangalore branch:", mng);

  const [cust, vend, ledger, bills, quotes, opening] = await Promise.all([
    prisma.customer.findMany({ where: { branchId: mng.id } }),
    prisma.vendor.findMany({ where: { branchId: mng.id } }),
    prisma.cashLedgerEntry.findMany({ where: { branchId: mng.id } }),
    prisma.vendorBill.findMany({ where: { branchId: mng.id } }),
    prisma.quotation.findMany({ where: { branchId: mng.id } }),
    prisma.ledgerOpeningBalance.findMany({ where: { branchId: mng.id } }),
  ]);

  console.log("Mangalore customers:", cust.length);
  console.log("Mangalore vendors:", vend.length);
  console.log("Mangalore ledger entries:", ledger.length);
  console.log("Mangalore vendor bills:", bills.length);
  console.log("Mangalore quotations:", quotes.length);
  console.log("Mangalore opening balances:", opening.length);
}

checkMangalore().finally(() => prisma.$disconnect());
