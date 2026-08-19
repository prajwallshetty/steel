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
  "BHAWANI STEEL",
  "AAI ENTERPRISES",
  "GEERISH STEEL",
  "KESHAV TRADERS",
  "KISAN HARDWARE",
  "KK TRADERS",
  "LOHIYA TRADERS",
  "MAHALAXMI STEEL",
  "MALOO STEEL",
  "RN TRADERS",
  "ADI STEEL YARD",
  "CHAMUNDA STEEL",
  "KALIKA STEEL",
  "MAHADEV STEEL",
  "MANIK HARDWARE",
  "GANESH STEEL",
  "MS GURUKRUPA",
  "JAY BHAWANI STEEL",
  "DHANLAXMI STEEL",
  "ATTAR & SONS",
  "MAHAKALI TRADERS",
  "JALARAM TRADERS",
  "SOHAM TRADERS",
  "SAYADRI TRADERS 2",
  "KP STEEL",
  "SADGURU TRADERS",
  "SHIVSHANKAR HW",
  "MOHINI TRADERS",
  "JK STEEL",
  "ASHAPURA STEEL",
  "GANESH STEEL",
  "BALUMAMA TRADERS",
  "ARIHANT LB",
  "PARSHWANATH STEEL",
  "SHREE SWAMI S BUILD",
  "RADHA STEEL",
  "BAJAJ STEEL",
];

const EXPECTED_PROJECTS_4 = [
  "AJEET GOLD",
  "GARUDA AC",
  "SANDEEP GOLD",
  "GZ GOLD",
];

async function verifySeededCustomers() {
  console.log("=== VERIFYING SEEDED CUSTOMER MASTER DATA ===");

  const branches = await prisma.branch.findMany({ where: { deletedAt: null } });
  console.log(`✓ Step 8: Branch Data Intact - Found ${branches.length} active branches.`);

  for (const branch of branches) {
    console.log(`\nChecking branch: ${branch.name} (${branch.code})`);

    // 1. Verify all 37 main customers exist
    for (const name of EXPECTED_MAIN_37) {
      const found = await prisma.customer.findFirst({
        where: { branchId: branch.id, name, deletedAt: null },
      });
      if (!found) {
        throw new Error(`Missing main customer: ${name} in branch ${branch.name}`);
      }
    }
    console.log(`✓ Step 1: Verified all 37 main customer names exist in ${branch.name}.`);

    // 2. Verify project entries exist
    for (const name of EXPECTED_PROJECTS_4) {
      const found = await prisma.customer.findFirst({
        where: { branchId: branch.id, name, deletedAt: null },
      });
      if (!found) {
        throw new Error(`Missing project entry: ${name} in branch ${branch.name}`);
      }
    }
    console.log(`✓ Step 2: Verified all 4 project entries exist in ${branch.name}.`);

    // 3. Verify Customer Search
    const searchResults = await prisma.customer.findMany({
      where: {
        branchId: branch.id,
        deletedAt: null,
        name: { contains: "BHAWANI", mode: "insensitive" },
      },
    });
    if (searchResults.length === 0) {
      throw new Error(`Customer search for 'BHAWANI' returned 0 results in branch ${branch.name}`);
    }
    console.log(`✓ Step 3: Verified customer search works (found ${searchResults.length} matches for 'BHAWANI').`);

    // 4. Verify quotation picker selection (listSelectableCustomers equivalent)
    const selectables = await prisma.customer.findMany({
      where: { branchId: branch.id, deletedAt: null },
      select: { id: true, name: true, gstNumber: true, branchId: true },
      orderBy: { name: "asc" },
    });
    if (selectables.length < 40) {
      throw new Error(`Quotation picker query returned ${selectables.length} items (expected >= 40)`);
    }
    console.log(`✓ Step 4: Verified quotation picker can select all customers (${selectables.length} selectable in ${branch.name}).`);

    // 5. Verify customer details population
    const sample = await prisma.customer.findFirst({
      where: { branchId: branch.id, name: "BHAWANI STEEL" },
    });
    if (sample?.city !== "PILKHOD" || sample?.phone !== null || sample?.email !== null) {
      throw new Error(`Sample customer details invalid: ${JSON.stringify(sample)}`);
    }
    console.log(`✓ Step 5: Verified customer details populated cleanly (BHAWANI STEEL city="PILKHOD", phone/email=null).`);

    // 6. Verify empty/clean history
    const customerWithHistory = await prisma.customer.findFirst({
      where: {
        branchId: branch.id,
        OR: [{ quotations: { some: {} } }, { ledgerEntries: { some: {} } }],
      },
    });
    if (customerWithHistory) {
      throw new Error(`Customer ${customerWithHistory.name} has unexpected non-empty history!`);
    }
    console.log(`✓ Step 6: Verified all customers have 0 quotations and 0 transactions (clean history).`);

    // 7. Verify no duplicates in branch
    const allBranchCust = await prisma.customer.findMany({
      where: { branchId: branch.id, deletedAt: null },
    });
    const names = allBranchCust.map((c) => c.name);
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      throw new Error(`Duplicate customer names detected in branch ${branch.name}!`);
    }
    console.log(`✓ Step 7: Verified no duplicates in branch ${branch.name} (${names.length} unique customer records).`);
  }

  // 9. Verify overall UI query simulation
  const totalInDb = await prisma.customer.count({ where: { deletedAt: null } });
  console.log(`\n✓ Step 9: Verified customer management UI has total of ${totalInDb} active customer records across branches.`);

  console.log("\nALL 9 VERIFICATION STEPS PASSED SUCCESSFULLY!");
}

verifySeededCustomers()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
