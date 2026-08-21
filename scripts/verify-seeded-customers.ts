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

const EXPECTED_MAIN_37 = [
  { name: "BHAWANI STEEL", city: "PILKHOD", garudaBalance: 0, currentDues: 0 },
  { name: "AAI ENTERPRISES", city: "CHIKLI", garudaBalance: 760855, currentDues: 0 },
  { name: "GEERISH STEEL", city: "KLP", garudaBalance: 2, currentDues: 0 },
  { name: "KESHAV TRADERS", city: "TADAWALE", garudaBalance: 703454, currentDues: 703454 },
  { name: "KISAN HARDWARE", city: "HATKANAGLE", garudaBalance: 0, currentDues: 0 },
  { name: "KK TRADERS", city: "KURUNDAWAD", garudaBalance: 1297350, currentDues: 0 },
  { name: "LOHIYA TRADERS", city: "AMBAJOGAI", garudaBalance: 121, currentDues: 0 },
  { name: "MAHALAXMI STEEL", city: "KM", garudaBalance: 52, currentDues: 52 },
  { name: "MALOO STEEL", city: "JAYSINGPUR", garudaBalance: 927390, currentDues: 800494 },
  { name: "RN TRADERS", city: "UMERGA", garudaBalance: 581808, currentDues: 582173 },
  { name: "ADI STEEL YARD", city: "ICHALKARANJI", garudaBalance: -50, currentDues: 0 },
  { name: "CHAMUNDA STEEL", city: "PATAN", garudaBalance: 98, currentDues: 98 },
  { name: "KALIKA STEEL", city: "SATANA", garudaBalance: -32, currentDues: 0 },
  { name: "MAHADEV STEEL", city: "PIMPALNER", garudaBalance: -3, currentDues: 0 },
  { name: "MANIK HARDWARE", city: "ICHALKARANJI", garudaBalance: 0, currentDues: 0 },
  { name: "GANESH STEEL", city: "KHAPAR", garudaBalance: -549628, currentDues: 0 },
  { name: "MS GURUKRUPA", city: "RK NAGAR", garudaBalance: 462598, currentDues: 462598 },
  { name: "JAY BHAWANI STEEL", city: "CHIPLUN", garudaBalance: 391, currentDues: 0 },
  { name: "DHANLAXMI STEEL", city: "KUDASHI", garudaBalance: 3, currentDues: 0 },
  { name: "ATTAR & SONS", city: "BALINGA", garudaBalance: 0, currentDues: 0 },
  { name: "MAHAKALI TRADERS", city: "KELGHAR", garudaBalance: 109029, currentDues: 109029 },
  { name: "JALARAM TRADERS", city: "AJARA", garudaBalance: 0, currentDues: 0 },
  { name: "SOHAM TRADERS", city: "PACHWAD", garudaBalance: 0, currentDues: 0 },
  { name: "SAYADRI TRADERS 2", city: "BONDAWADE", garudaBalance: -31, currentDues: 0 },
  { name: "KP STEEL", city: "MERRAJ", garudaBalance: 298732, currentDues: 0 },
  { name: "SADGURU TRADERS", city: "GOTWADE", garudaBalance: 599612, currentDues: 0 },
  { name: "SHIVSHANKAR HW", city: "BHOKAR", garudaBalance: 0, currentDues: 0 },
  { name: "MOHINI TRADERS", city: "TAKALI", garudaBalance: 195826, currentDues: 195826 },
  { name: "JK STEEL", city: "ICHK", garudaBalance: 6643, currentDues: 6643 },
  { name: "ASHAPURA STEEL", city: "MUDHUL", garudaBalance: -92, currentDues: 0 },
  { name: "GANESH STEEL", city: "ARAG", garudaBalance: 0, currentDues: 0 },
  { name: "BALUMAMA TRADERS", city: "NIDHORI", garudaBalance: 0, currentDues: 0 },
  { name: "ARIHANT LB", city: "CHALISGAON", garudaBalance: 361911, currentDues: 361663 },
  { name: "PARSHWANATH STEEL", city: "JAYSINGPUR", garudaBalance: 0, currentDues: 0 },
  { name: "SHREE SWAMI S BUILD", city: "KOLHAPUR", garudaBalance: -8559, currentDues: 0 },
  { name: "RADHA STEEL", city: "SANGLI", garudaBalance: 39, currentDues: 39 },
  { name: "BAJAJ STEEL", city: "SANGLI", garudaBalance: 542, currentDues: 542 },
];

const EXPECTED_PROJECTS_3 = [
  { name: "AJEET GOLD", city: null, garudaBalance: 2400, currentDues: 0 },
  { name: "MAHARASHTRA AC", city: null, garudaBalance: -136861, currentDues: 0 },
  { name: "SANDEEP GOLD", city: null, garudaBalance: 335604, currentDues: 0 },
];

async function verifySeededCustomers() {
  console.log("=== VERIFYING SEEDED GARUDA STATEMENT DATA ===");

  const branches = await prisma.branch.findMany({ where: { deletedAt: null } });
  console.log(`✓ Active branches intact: ${branches.length} branch(es) found (${branches.map((b) => b.name).join(", ")}).`);

  const maharashtraBranch = branches.find((b) => b.code === "MAH");
  if (!maharashtraBranch) {
    throw new Error("Maharashtra branch (MAH) missing!");
  }

  // 1. Verify 37 main customer records under Maharashtra
  for (const expected of EXPECTED_MAIN_37) {
    const found = await prisma.customer.findFirst({
      where: {
        branchId: maharashtraBranch.id,
        name: expected.name,
        city: expected.city,
        deletedAt: null,
      },
    });

    if (!found) {
      throw new Error(`Missing customer: ${expected.name} (${expected.city}) in Maharashtra branch`);
    }

    if (Number(found.garudaBalance) !== expected.garudaBalance) {
      throw new Error(`Balance mismatch for ${expected.name}: expected ${expected.garudaBalance}, got ${Number(found.garudaBalance)}`);
    }

    if (Number(found.currentDues) !== expected.currentDues) {
      throw new Error(`Current Dues mismatch for ${expected.name}: expected ${expected.currentDues}, got ${Number(found.currentDues)}`);
    }
  }
  console.log("✓ Step 1: Verified all 37 customer records with exact Party Name, Location, Garuda Balance & Current Dues.");

  // 2. Verify 3 project records under Maharashtra
  for (const expected of EXPECTED_PROJECTS_3) {
    const found = await prisma.customer.findFirst({
      where: {
        branchId: maharashtraBranch.id,
        name: expected.name,
        deletedAt: null,
      },
    });

    if (!found) {
      throw new Error(`Missing project record: ${expected.name} in Maharashtra branch`);
    }

    if (Number(found.garudaBalance) !== expected.garudaBalance) {
      throw new Error(`Balance mismatch for project ${expected.name}: expected ${expected.garudaBalance}, got ${Number(found.garudaBalance)}`);
    }
  }
  console.log("✓ Step 2: Verified all 3 project records with exact Party Name & Garuda Balance.");

  // 3. Verify total customer count under Maharashtra
  const mahCustomerCount = await prisma.customer.count({
    where: { branchId: maharashtraBranch.id, deletedAt: null },
  });

  if (mahCustomerCount !== 40) {
    throw new Error(`Expected 40 records under Maharashtra Branch, found ${mahCustomerCount}`);
  }
  console.log(`✓ Step 3: Verified exact total of 40 records (37 customers + 3 projects) under Maharashtra Branch.`);

  // 4. Verify clean operational history
  const [quotationsCount, ledgerCount, vendorBillCount] = await Promise.all([
    prisma.quotation.count({}),
    prisma.cashLedgerEntry.count({}),
    prisma.vendorBill.count({}),
  ]);

  if (quotationsCount > 0 || ledgerCount > 0 || vendorBillCount > 0) {
    throw new Error(`Operational data not clean! Quotations: ${quotationsCount}, Ledger: ${ledgerCount}, Bills: ${vendorBillCount}`);
  }
  console.log("✓ Step 4: Verified clean operational history (0 quotations, 0 cash ledger entries, 0 vendor bills).");

  // 5. Verify customer search
  const searchResult = await prisma.customer.findMany({
    where: {
      branchId: maharashtraBranch.id,
      deletedAt: null,
      name: { contains: "GANESH", mode: "insensitive" },
    },
  });
  if (searchResult.length !== 2) {
    throw new Error(`Customer search for 'GANESH' expected 2 matches (KHAPAR & ARAG), got ${searchResult.length}`);
  }
  console.log("✓ Step 5: Verified search functionality (found 2 GANESH STEEL records: KHAPAR & ARAG).");

  console.log("\nALL VERIFICATION STEPS PASSED SUCCESSFULLY!");
}

verifySeededCustomers()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
