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

async function cleanOpeningLedgerEntries() {
  console.log("=== REMOVING FAKE CASH LEDGER OPENING ENTRIES ===");

  const res = await prisma.cashLedgerEntry.deleteMany({
    where: {
      particular: { contains: "Opening" },
    },
  });

  console.log(`✓ Deleted ${res.count} opening balance cash ledger entries.`);
  console.log("Cash ledger entries table now contains only real cash/bank movements.");
}

cleanOpeningLedgerEntries()
  .catch((err) => {
    console.error("Cleaning failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
