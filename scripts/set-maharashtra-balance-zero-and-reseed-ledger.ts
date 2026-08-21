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

async function rollbackAndSetZeroBalance() {
  console.log("=== ROLLING BACK LEDGER ENTRIES & SETTING MAHARASHTRA STARTING BALANCE TO 0 ===");

  // 1. Update Maharashtra branch starting balance to 0
  const maharashtraBranch = await prisma.branch.findFirst({
    where: { code: "MAH", deletedAt: null },
  });

  if (!maharashtraBranch) {
    throw new Error("Maharashtra branch not found!");
  }

  await prisma.branch.update({
    where: { id: maharashtraBranch.id },
    data: { startingBalance: 0 },
  });
  console.log("✓ Updated Maharashtra Branch starting balance to 0.");

  // 2. Delete any existing opening ledger entries to avoid duplicates
  await prisma.cashLedgerEntry.deleteMany({
    where: { particular: { contains: "Opening" } },
  });

  const superAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });

  // 3. Re-seed Customer Ledger Opening Entries
  const customers = await prisma.customer.findMany({
    where: { branchId: maharashtraBranch.id, deletedAt: null },
  });

  let custCount = 0;
  for (let i = 0; i < customers.length; i++) {
    const cust = customers[i];
    const bal = Number(cust.garudaBalance || cust.currentDues || 0);

    if (bal === 0) continue;

    const direction = bal > 0 ? "CREDIT" : "DEBIT";
    const absAmount = Math.abs(bal);
    const refNum = String(i + 1).padStart(4, "0");
    const ref = `MAH/OB/CUST/${refNum}`;

    await prisma.cashLedgerEntry.create({
      data: {
        reference: ref,
        entryDate: new Date("2025-10-01"),
        branchId: maharashtraBranch.id,
        customerId: cust.id,
        partyType: "CUSTOMER",
        partyName: cust.name,
        direction,
        amount: absAmount,
        paymentMethod: "CASH",
        particular: "Opening Party Balance",
        note: cust.city ? `Location: ${cust.city}` : "Project Opening Balance",
        status: "CLEARED",
        createdById: superAdmin?.id ?? null,
        approvedById: superAdmin?.id ?? null,
        approvedAt: new Date("2025-10-01"),
      },
    });
    custCount++;
  }
  console.log(`✓ Re-seeded ${custCount} customer opening balance ledger entries.`);

  // 4. Re-seed Vendor Ledger Opening Entries
  const vendors = await prisma.vendor.findMany({
    where: { branchId: maharashtraBranch.id, deletedAt: null },
  });

  let vendCount = 0;
  for (let i = 0; i < vendors.length; i++) {
    const vend = vendors[i];
    const bal = Number(vend.balance || 0);

    if (bal === 0) continue;

    const direction = bal > 0 ? "DEBIT" : "CREDIT";
    const absAmount = Math.abs(bal);
    const refNum = String(i + 1).padStart(4, "0");
    const ref = `MAH/OB/VEND/${refNum}`;

    await prisma.cashLedgerEntry.create({
      data: {
        reference: ref,
        entryDate: new Date("2025-10-01"),
        branchId: maharashtraBranch.id,
        vendorId: vend.id,
        partyType: "VENDOR",
        partyName: vend.name,
        direction,
        amount: absAmount,
        paymentMethod: "CASH",
        particular: "Opening Vendor Liability",
        note: "Initial seeded vendor balance",
        status: "CLEARED",
        createdById: superAdmin?.id ?? null,
        approvedById: superAdmin?.id ?? null,
        approvedAt: new Date("2025-10-01"),
      },
    });
    vendCount++;
  }
  console.log(`✓ Re-seeded ${vendCount} vendor opening balance ledger entries.`);

  console.log("\nROLLBACK & SEEDING COMPLETED SUCCESSFULLY!");
}

rollbackAndSetZeroBalance()
  .catch((err) => {
    console.error("Rollback failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
