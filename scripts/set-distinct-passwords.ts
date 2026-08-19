import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
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

const USER_CREDENTIALS: { username: string; plainPassword: string }[] = [
  { username: "superadmin", plainPassword: "Superadmin@2026" },
  { username: "mangalore.admin", plainPassword: "Mangalore@admin2026" },
  { username: "mangalore.manager1", plainPassword: "Mangalore@manager2026" },
  { username: "mangalore.manager2", plainPassword: "Mangalore@manager2" },
  { username: "maharashtra.admin", plainPassword: "Maharashtra@admin2026" },
  { username: "maharashtra.manager1", plainPassword: "Maharashtra@manager2026" },
  { username: "maharashtra.manager2", plainPassword: "Maharashtra@manager2" },
];

async function setDistinctPasswords() {
  console.log("Setting distinct passwords for each user account...");

  for (const cred of USER_CREDENTIALS) {
    const passwordHash = await bcrypt.hash(cred.plainPassword, 12);

    const user = await prisma.user.findUnique({
      where: { username: cred.username },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      console.log(`Updated '${cred.username}': set distinct password.`);
    } else {
      console.warn(`User '${cred.username}' not found in database.`);
    }
  }

  console.log("Distinct passwords set for all users!");
}

setDistinctPasswords()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
