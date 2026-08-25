import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { listCustomerOutstanding } from "../src/modules/customer-outstanding/customer-outstanding-service";
import { listVendorOutstanding } from "../src/modules/vendor-outstanding/vendor-outstanding-service";

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

  const customerOut = await listCustomerOutstanding(subject);
  console.log(`\n=== CUSTOMER OUTSTANDING REPORT ===`);
  console.log(`Total Customers: ${customerOut.totalCustomers}`);
  console.log(`Total Billed:    ₹${customerOut.totalBilledSum.toLocaleString("en-IN")}`);
  console.log(`Total Paid:      ₹${customerOut.totalPaidSum.toLocaleString("en-IN")}`);
  console.log(`Outstanding:     ₹${customerOut.totalOutstandingSum.toLocaleString("en-IN")}`);
  console.log("Sample Customers (first 5):");
  customerOut.items.slice(0, 5).forEach((c) => {
    console.log(`  - ${c.name} | Billed: ₹${c.totalBilled} | Paid: ₹${c.totalPaid} | Outstanding: ₹${c.outstandingAmount} | Status: ${c.paymentStatus}`);
  });

  const vendorOut = await listVendorOutstanding(subject);
  console.log(`\n=== VENDOR OUTSTANDING REPORT ===`);
  console.log(`Total Vendors:   ${vendorOut.totalVendors}`);
  console.log(`Total Payable:   ₹${vendorOut.totalPayableSum.toLocaleString("en-IN")}`);
  console.log(`Total Paid:      ₹${vendorOut.totalPaidSum.toLocaleString("en-IN")}`);
  console.log(`Outstanding:     ₹${vendorOut.totalOutstandingSum.toLocaleString("en-IN")}`);
  console.log("Sample Vendors (first 5):");
  vendorOut.items.slice(0, 5).forEach((v) => {
    console.log(`  - ${v.name} | Payable: ₹${v.totalPayable} | Paid: ₹${v.totalPaid} | Outstanding: ₹${v.outstandingAmount} | Status: ${v.paymentStatus}`);
  });
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
