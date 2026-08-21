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

const TARGET_NAMES = ["AJEET GOLD", "AJEETH GOLD", "SANDEEP GOLD", "MAHARASHTRA AC", "MAHARASTRA AC"];

async function main() {
  console.log("=== MIGRATING AJEET GOLD, SANDEEP GOLD, MAHARASHTRA AC TO STAFF & CLEANING CUSTOMERS ===");

  const customers = await prisma.customer.findMany({
    where: {
      OR: TARGET_NAMES.map((name) => ({
        name: { equals: name, mode: "insensitive" },
      })),
    },
  });

  console.log(`Found ${customers.length} customer record(s) matching target names.`);

  for (const customer of customers) {
    console.log(`Processing customer: ${customer.name} (ID: ${customer.id}, Balance: ${customer.garudaBalance})`);

    // Check if staff record exists
    const existingStaff = await prisma.staff.findFirst({
      where: {
        branchId: customer.branchId,
        name: { equals: customer.name, mode: "insensitive" },
      },
    });

    if (!existingStaff) {
      await prisma.staff.create({
        data: {
          name: customer.name.toUpperCase(),
          designation: "Staff Account",
          balance: customer.garudaBalance,
          branchId: customer.branchId,
        },
      });
      console.log(`✓ Created Staff record for "${customer.name}" with balance ${customer.garudaBalance}`);
    } else {
      console.log(`Staff record already exists for "${customer.name}".`);
    }

    // Soft-delete or hard delete customer record
    await prisma.customer.update({
      where: { id: customer.id },
      data: { deletedAt: new Date() },
    });
    console.log(`✓ Soft-deleted Customer record for "${customer.name}" (ID: ${customer.id})`);
  }

  // Double check if any remain
  const remainingCustomers = await prisma.customer.count({
    where: {
      deletedAt: null,
      OR: TARGET_NAMES.map((name) => ({
        name: { equals: name, mode: "insensitive" },
      })),
    },
  });

  console.log(`Active target customers remaining: ${remainingCustomers}`);
  console.log("=== MIGRATION COMPLETED SUCCESSFULLY ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
