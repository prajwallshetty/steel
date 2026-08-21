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

async function setMangaloreZero() {
  console.log("=== SETTING MANGLORE BALANCE TO 0 ===");

  const updated = await prisma.branch.updateMany({
    where: { code: "MNG" },
    data: { startingBalance: 0 },
  });

  console.log(`✓ Updated ${updated.count} branch(es) matching 'MNG' with startingBalance = 0.`);

  const mng = await prisma.branch.findFirst({ where: { code: "MNG" } });
  console.log("Mangalore Branch current state:", mng);
}

setMangaloreZero()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
