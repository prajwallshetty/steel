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

const USER_CREDENTIALS: Record<string, { username: string; password: string }> = {
  superadmin: { username: "superadmin", password: "Superadmin@2026" },
  "mangalore.admin": { username: "mangalore.admin", password: "Mangalore@admin2026" },
  "mangalore.manager1": { username: "mangalore.manager1", password: "Mangalore@manager2026" },
  "mangalore.manager2": { username: "mangalore.manager2", password: "Mangalore@manager2" },
  "maharashtra.admin": { username: "maharashtra.admin", password: "Maharashtra@admin2026" },
  "maharashtra.manager1": { username: "maharashtra.manager1", password: "Maharashtra@manager2026" },
  "maharashtra.manager2": { username: "maharashtra.manager2", password: "Maharashtra@manager2" },
};

const PREVIOUS_USERNAME_TO_KEY: Record<string, string> = {
  "manglore@superadmin": "superadmin",
  "manglore@admin": "mangalore.admin",
  "manglore@manager": "mangalore.manager1",
  "manglore@manager2": "mangalore.manager2",
  "maharashtra@admin": "maharashtra.admin",
  "maharashtra@manager": "maharashtra.manager1",
  "maharashtra@manager2": "maharashtra.manager2",
};

async function updateUserCredentials() {
  console.log("Updating user credentials to matching unique passwords...");

  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} user accounts.`);

  for (const user of users) {
    const key = PREVIOUS_USERNAME_TO_KEY[user.username] ?? user.username;
    const target = USER_CREDENTIALS[key];

    if (!target) {
      console.log(`Skipping user '${user.username}' (no unique password mapped).`);
      continue;
    }

    const passwordHash = await bcrypt.hash(target.password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        username: target.username,
        passwordHash,
      },
    });

    console.log(`Updated user '${user.username}': set username to '${target.username}' and password to '${target.password}'`);
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
