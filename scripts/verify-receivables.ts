import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getDashboardMetrics } from "../src/modules/dashboard/dashboard-service";

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

async function main() {
  const users = await prisma.user.findMany();
  const superAdmin = users.find((u) => u.role === "SUPER_ADMIN");
  if (!superAdmin) {
    console.error("No super admin found");
    process.exit(1);
  }

  const subject = {
    id: superAdmin.id,
    role: superAdmin.role,
    branchId: superAdmin.branchId,
    extraPermissions: superAdmin.extraPermissions,
    deniedPermissions: superAdmin.deniedPermissions,
  };

  const metrics = await getDashboardMetrics(subject);
  console.log("=== DASHBOARD RECEIVABLES & CASH IN HAND ===");
  console.log(`Customer Receivables (Outstanding): ₹${metrics.outstandingReceivables.toLocaleString("en-IN")}`);
  console.log(`Cash Balance:                       ₹${metrics.cashBalance.toLocaleString("en-IN")}`);
  console.log("=========================================");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
