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

async function restoreStandardUsernames() {
  console.log("Restoring standard branch/role usernames and updating passwords...");

  const passwordHash = await bcrypt.hash("manglore@2026", 12);

  const users = await prisma.user.findMany({
    include: { branch: true },
  });

  for (const user of users) {
    let targetUsername = user.username;

    if (user.role === "SUPER_ADMIN") {
      targetUsername = "superadmin";
    } else if (user.branch?.code === "MNG") {
      if (user.role === "BRANCH_ADMIN") {
        targetUsername = "mangalore.admin";
      } else if (user.username.includes("manager2")) {
        targetUsername = "mangalore.manager2";
      } else {
        targetUsername = "mangalore.manager1";
      }
    } else if (user.branch?.code === "MAH") {
      if (user.role === "BRANCH_ADMIN") {
        targetUsername = "maharashtra.admin";
      } else if (user.username.includes("manager2")) {
        targetUsername = "maharashtra.manager2";
      } else {
        targetUsername = "maharashtra.manager1";
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        username: targetUsername,
        passwordHash,
      },
    });

    console.log(`Updated ID: ${user.id} -> Username: '${targetUsername}' (${user.role}, ${user.branch?.name ?? "Global"})`);
  }

  console.log("All usernames and passwords successfully updated!");
}

restoreStandardUsernames()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
