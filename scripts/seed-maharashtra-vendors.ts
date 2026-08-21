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

const VENDORS_TO_SEED = [
  { name: "ARYA STEEL", amount: 3055944 },
  { name: "SAMARTH TC", amount: 90696 },
  { name: "BABASAHEB 6MM", amount: 64204 },
  { name: "SHREEJI STEEL CENTER", amount: -804420 },
  { name: "SHAKTI GOLD", amount: 776 },
];

async function seedMaharashtraVendors() {
  console.log("=== VENDOR CLEANUP & SEEDING FOR MAHARASHTRA BRANCH ===");

  try {
    // 1. Ensure 'balance' column exists in 'vendors' table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "balance" DECIMAL(16,2) DEFAULT 0 NOT NULL;
    `);
    console.log("✓ Added 'balance' column to vendors table if not exists.");

    // 2. Remove any vendor bills and vendor ledger entries
    const deletedBills = await prisma.vendorBill.deleteMany({});
    console.log(`✓ Deleted ${deletedBills.count} VendorBill records.`);

    const deletedVendorLedger = await prisma.cashLedgerEntry.deleteMany({
      where: {
        OR: [
          { vendorId: { not: null } },
          { partyType: "VENDOR" },
        ],
      },
    });
    console.log(`✓ Deleted ${deletedVendorLedger.count} vendor cash ledger entries.`);

    // 3. Remove all existing vendor records from the database
    const deletedVendors = await prisma.vendor.deleteMany({});
    console.log(`✓ Deleted ${deletedVendors.count} existing Vendor records.`);

    // 4. Identify Maharashtra branch
    const maharashtraBranch = await prisma.branch.findFirst({
      where: { code: "MAH", deletedAt: null },
    });

    if (!maharashtraBranch) {
      throw new Error("Maharashtra branch (MAH) not found!");
    }
    console.log(`✓ Found Maharashtra Branch: ${maharashtraBranch.name} (${maharashtraBranch.id})`);

    const superAdmin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
    });

    // 5. Seed ONLY the 5 Maharashtra vendors
    let totalCalculated = 0;
    for (const v of VENDORS_TO_SEED) {
      const created = await prisma.vendor.create({
        data: {
          name: v.name,
          balance: v.amount,
          state: "Maharashtra",
          branchId: maharashtraBranch.id,
          createdById: superAdmin?.id ?? null,
          updatedById: superAdmin?.id ?? null,
        },
      });
      totalCalculated += v.amount;
      console.log(`  - Seeded vendor: ${created.name} | Amount: ₹${v.amount.toLocaleString("en-IN")}`);
    }

    console.log(`\n✓ Total seeded vendors: ${VENDORS_TO_SEED.length}`);
    console.log(`✓ Total Vendor Liability: ₹${totalCalculated.toLocaleString("en-IN")}`);

    const expectedTotal = 2407200;
    if (totalCalculated !== expectedTotal) {
      throw new Error(`Total mismatch! Expected ₹${expectedTotal}, got ₹${totalCalculated}`);
    }
    console.log(`✓ Confirmed total matches exact expected liability ₹24,07,200!`);

  } catch (error) {
    console.error("Vendor seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedMaharashtraVendors();
