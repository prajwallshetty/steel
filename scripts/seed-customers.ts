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

interface CustomerSeedItem {
  name: string;
  city: string | null;
}

const RAW_CUSTOMERS: CustomerSeedItem[] = [
  // 37 Main Customers
  { name: "BHAWANI STEEL", city: "PILKHOD" },
  { name: "AAI ENTERPRISES", city: "CHIKLI" },
  { name: "GEERISH STEEL", city: "KLP" },
  { name: "KESHAV TRADERS", city: "TADAWALE" },
  { name: "KISAN HARDWARE", city: "HATKANAGLE" },
  { name: "KK TRADERS", city: "KURUNDAWAD" },
  { name: "LOHIYA TRADERS", city: "AMBAJOGAI" },
  { name: "MAHALAXMI STEEL", city: "KM" },
  { name: "MALOO STEEL", city: "JAYSINGPUR" },
  { name: "RN TRADERS", city: "UMERGA" },
  { name: "ADI STEEL YARD", city: "ICHKARANJI" },
  { name: "CHAMUNDA STEEL", city: "PATAN" },
  { name: "KALIKA STEEL", city: "SATANA" },
  { name: "MAHADEV STEEL", city: "PIMPALNER" },
  { name: "MANIK HARDWARE", city: "ICHKARANJI" },
  { name: "GANESH STEEL", city: "KHAPAR" },
  { name: "MS GURUKRUPA", city: "RK NAGAR" },
  { name: "JAY BHAWANI STEEL", city: "CHIPLUN" },
  { name: "DHANLAXMI STEEL", city: "KUDASHI" },
  { name: "ATTAR & SONS", city: "BALINGA" },
  { name: "MAHAKALI TRADERS", city: "KELGHAR" },
  { name: "JALARAM TRADERS", city: "AJARA" },
  { name: "SOHAM TRADERS", city: "PACHWAD" },
  { name: "SAYADRI TRADERS 2", city: "BONDAWADE" },
  { name: "KP STEEL", city: "MERRAJ" },
  { name: "SADGURU TRADERS", city: "GOTWADE" },
  { name: "SHIVSHANKAR HW", city: "BHOKAR" },
  { name: "MOHINI TRADERS", city: "TAKALI" },
  { name: "JK STEEL", city: "ICHK" },
  { name: "ASHAPURA STEEL", city: "MUDHOL" },
  { name: "GANESH STEEL", city: "ARAG" },
  { name: "BALUMAMA TRADERS", city: "NIDHORI" },
  { name: "ARIHANT LB", city: "CHALISGAON" },
  { name: "PARSHWANATH STEEL", city: "JAYSINGPUR" },
  { name: "SHREE SWAMI S BUILD", city: "KOLHAPUR" },
  { name: "RADHA STEEL", city: "SANGLI" },
  { name: "BAJAJ STEEL", city: "SANGLI" },

  // 4 Project / Party Entries
  { name: "AJEET GOLD", city: null },
  { name: "GARUDA AC", city: null },
  { name: "SANDEEP GOLD", city: null },
  { name: "GZ GOLD", city: null },
];

async function seedCustomers() {
  console.log("Seeding Customer Master Data...");

  const branches = await prisma.branch.findMany({
    where: { deletedAt: null },
  });

  if (branches.length === 0) {
    console.error("Error: No active branches found in database.");
    process.exit(1);
  }

  console.log(`Found ${branches.length} active branch(es): ${branches.map((b) => b.name).join(", ")}`);

  const superAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });

  let createdCount = 0;
  let updatedCount = 0;

  for (const branch of branches) {
    for (const item of RAW_CUSTOMERS) {
      const existing = await prisma.customer.findUnique({
        where: {
          branchId_name: {
            branchId: branch.id,
            name: item.name,
          },
        },
      });

      if (!existing) {
        await prisma.customer.create({
          data: {
            name: item.name,
            city: item.city,
            branchId: branch.id,
            createdById: superAdmin?.id ?? null,
            updatedById: superAdmin?.id ?? null,
          },
        });
        createdCount++;
      } else {
        // Update city if it was null before
        if (!existing.city && item.city) {
          await prisma.customer.update({
            where: { id: existing.id },
            data: { city: item.city },
          });
          updatedCount++;
        }
      }
    }
  }

  console.log(`Customer master seeding complete!`);
  console.log(`- Created: ${createdCount} new customer records across branches.`);
  console.log(`- Updated: ${updatedCount} existing customer records.`);

  // Verify total count in database
  const totalCustomers = await prisma.customer.count({
    where: { deletedAt: null },
  });
  console.log(`Total active customers in database: ${totalCustomers}`);
}

seedCustomers()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
