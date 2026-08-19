import { PrismaClient, Role } from "@prisma/client";
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

const USERNAME_MAPPINGS: Record<string, string> = {
  superadmin: "manglore@superadmin",
  "mangalore.admin": "manglore@admin",
  "mangalore.manager1": "manglore@manager",
  "mangalore.manager2": "manglore@manager2",
  "maharashtra.admin": "maharashtra@admin",
  "maharashtra.manager1": "maharashtra@manager",
  "maharashtra.manager2": "maharashtra@manager2",
};

async function updateUserCredentials() {
  console.log("Updating user credentials...");

  const passwordHash = await bcrypt.hash("manglore@2026", 12);

  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} user accounts.`);

  for (const user of users) {
    const newUsername = USERNAME_MAPPINGS[user.username] ?? user.username;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        username: newUsername,
        passwordHash,
      },
    });

    console.log(`Updated user ${user.id}: username='${newUsername}', role='${user.role}', password set to 'manglore@2026'`);
  }

  console.log("All user credentials updated successfully!");
}

updateUserCredentials()
  .catch((err) => {
    console.error("Update failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
