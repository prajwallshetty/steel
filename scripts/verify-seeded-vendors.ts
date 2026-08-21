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

const EXPECTED_VENDORS = [
  { name: "ARYA STEEL", amount: 3055944 },
  { name: "SAMARTH TC", amount: 90696 },
  { name: "BABASAHEB 6MM", amount: 64204 },
  { name: "SHREEJI STEEL CENTER", amount: -804420 },
  { name: "SHAKTI GOLD", amount: 776 },
];

async function verifySeededVendors() {
  console.log("=== VERIFYING SEEDED MAHARASHTRA VENDORS ===");

  const maharashtraBranch = await prisma.branch.findFirst({
    where: { code: "MAH", deletedAt: null },
  });

  if (!maharashtraBranch) {
    throw new Error("Maharashtra branch (MAH) not found!");
  }

  // 1. Check total count of vendors across entire database
  const totalInDb = await prisma.vendor.count({
    where: { deletedAt: null },
  });
  if (totalInDb !== 5) {
    throw new Error(`Expected exactly 5 active vendors in the database, found ${totalInDb}`);
  }
  console.log(`✓ Total vendors in database: 5 (no old vendors retained)`);

  // 2. Check each vendor and amount
  let totalLiability = 0;
  for (const expected of EXPECTED_VENDORS) {
    const found = await prisma.vendor.findFirst({
      where: {
        branchId: maharashtraBranch.id,
        name: expected.name,
        deletedAt: null,
      },
    });

    if (!found) {
      throw new Error(`Missing expected vendor: ${expected.name} in Maharashtra Branch`);
    }

    const actualAmount = Number(found.balance);
    if (actualAmount !== expected.amount) {
      throw new Error(`Amount mismatch for ${expected.name}: expected ₹${expected.amount}, got ₹${actualAmount}`);
    }

    totalLiability += actualAmount;
    console.log(`✓ Verified vendor: ${found.name.padEnd(22)} | Amount: ₹${actualAmount.toLocaleString("en-IN").padStart(12)}`);
  }

  // 3. Check total liability
  console.log(`\n✓ Calculated Total Liability: ₹${totalLiability.toLocaleString("en-IN")}`);
  if (totalLiability !== 2407200) {
    throw new Error(`Total liability expected 2407200, but got ${totalLiability}`);
  }
  console.log(`✓ Confirmed total liability is EXACTLY ₹24,07,200!`);

  // 4. Verify no active vendor bills or legacy vendor ledger entries
  const [billCount, ledgerCount] = await Promise.all([
    prisma.vendorBill.count({ where: { deletedAt: null } }),
    prisma.cashLedgerEntry.count({
      where: {
        OR: [{ vendorId: { not: null } }, { partyType: "VENDOR" }],
        deletedAt: null,
      },
    }),
  ]);

  if (billCount !== 0 || ledgerCount !== 0) {
    throw new Error(`Found unexpected old vendor transactions: Bills=${billCount}, Ledger=${ledgerCount}`);
  }
  console.log(`✓ Verified 0 old vendor transactions / bills exist.`);

  console.log("\nALL VENDOR VERIFICATION CHECKS PASSED SUCCESSFULLY!");
}

verifySeededVendors()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
