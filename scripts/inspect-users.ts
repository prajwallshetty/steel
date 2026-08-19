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

async function inspectUsers() {
  const users = await prisma.user.findMany({
    include: { branch: true },
    orderBy: { createdAt: "asc" },
  });

  console.log("=== EXISTING USERS IN DATABASE ===");
  for (const u of users) {
    console.log(`ID: ${u.id} | Username: ${u.username} | Role: ${u.role} | Branch: ${u.branch?.name ?? "Global"} (${u.branch?.code ?? "NONE"}) | Email: ${u.email}`);
  }
}

inspectUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
