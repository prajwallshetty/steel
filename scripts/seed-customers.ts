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
  garudaBalance: number;
  currentDues: number;
}

const GARUDA_CUSTOMERS: CustomerSeedItem[] = [
  // 37 Customer Records
  { name: "BHAWANI STEEL", city: "PILKHOD", garudaBalance: 0, currentDues: 0 },
  { name: "AAI ENTERPRISES", city: "CHIKLI", garudaBalance: 760855, currentDues: 0 },
  { name: "GEERISH STEEL", city: "KLP", garudaBalance: 2, currentDues: 0 },
  { name: "KESHAV TRADERS", city: "TADAWALE", garudaBalance: 703454, currentDues: 703454 },
  { name: "KISAN HARDWARE", city: "HATKANAGLE", garudaBalance: 0, currentDues: 0 },
  { name: "KK TRADERS", city: "KURUNDAWAD", garudaBalance: 1297350, currentDues: 0 },
  { name: "LOHIYA TRADERS", city: "AMBAJOGAI", garudaBalance: 121, currentDues: 0 },
  { name: "MAHALAXMI STEEL", city: "KM", garudaBalance: 52, currentDues: 52 },
  { name: "MALOO STEEL", city: "JAYSINGPUR", garudaBalance: 927390, currentDues: 800494 },
  { name: "RN TRADERS", city: "UMERGA", garudaBalance: 581808, currentDues: 582173 },
  { name: "ADI STEEL YARD", city: "ICHALKARANJI", garudaBalance: -50, currentDues: 0 },
  { name: "CHAMUNDA STEEL", city: "PATAN", garudaBalance: 98, currentDues: 98 },
  { name: "KALIKA STEEL", city: "SATANA", garudaBalance: -32, currentDues: 0 },
  { name: "MAHADEV STEEL", city: "PIMPALNER", garudaBalance: -3, currentDues: 0 },
  { name: "MANIK HARDWARE", city: "ICHALKARANJI", garudaBalance: 0, currentDues: 0 },
  { name: "GANESH STEEL", city: "KHAPAR", garudaBalance: -549628, currentDues: 0 },
  { name: "MS GURUKRUPA", city: "RK NAGAR", garudaBalance: 462598, currentDues: 462598 },
  { name: "JAY BHAWANI STEEL", city: "CHIPLUN", garudaBalance: 391, currentDues: 0 },
  { name: "DHANLAXMI STEEL", city: "KUDASHI", garudaBalance: 3, currentDues: 0 },
  { name: "ATTAR & SONS", city: "BALINGA", garudaBalance: 0, currentDues: 0 },
  { name: "MAHAKALI TRADERS", city: "KELGHAR", garudaBalance: 109029, currentDues: 109029 },
  { name: "JALARAM TRADERS", city: "AJARA", garudaBalance: 0, currentDues: 0 },
  { name: "SOHAM TRADERS", city: "PACHWAD", garudaBalance: 0, currentDues: 0 },
  { name: "SAYADRI TRADERS 2", city: "BONDAWADE", garudaBalance: -31, currentDues: 0 },
  { name: "KP STEEL", city: "MERRAJ", garudaBalance: 298732, currentDues: 0 },
  { name: "SADGURU TRADERS", city: "GOTWADE", garudaBalance: 599612, currentDues: 0 },
  { name: "SHIVSHANKAR HW", city: "BHOKAR", garudaBalance: 0, currentDues: 0 },
  { name: "MOHINI TRADERS", city: "TAKALI", garudaBalance: 195826, currentDues: 195826 },
  { name: "JK STEEL", city: "ICHK", garudaBalance: 6643, currentDues: 6643 },
  { name: "ASHAPURA STEEL", city: "MUDHUL", garudaBalance: -92, currentDues: 0 },
  { name: "GANESH STEEL", city: "ARAG", garudaBalance: 0, currentDues: 0 },
  { name: "BALUMAMA TRADERS", city: "NIDHORI", garudaBalance: 0, currentDues: 0 },
  { name: "ARIHANT LB", city: "CHALISGAON", garudaBalance: 361911, currentDues: 361663 },
  { name: "PARSHWANATH STEEL", city: "JAYSINGPUR", garudaBalance: 0, currentDues: 0 },
  { name: "SHREE SWAMI S BUILD", city: "KOLHAPUR", garudaBalance: -8559, currentDues: 0 },
  { name: "RADHA STEEL", city: "SANGLI", garudaBalance: 39, currentDues: 39 },
  { name: "BAJAJ STEEL", city: "SANGLI", garudaBalance: 542, currentDues: 542 },

];

async function seedGarudaCustomers() {
  console.log("Seeding Garuda Statement Data under Maharashtra Branch...");

  const maharashtraBranch = await prisma.branch.findFirst({
    where: { code: "MAH", deletedAt: null },
  });

  if (!maharashtraBranch) {
    console.error("Error: Maharashtra branch (MAH) not found in database.");
    process.exit(1);
  }

  console.log(`Found Maharashtra Branch: ${maharashtraBranch.name} (${maharashtraBranch.id})`);

  const superAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });

  let createdCount = 0;

  for (const item of GARUDA_CUSTOMERS) {
    await prisma.customer.create({
      data: {
        name: item.name,
        city: item.city,
        state: "Maharashtra",
        garudaBalance: item.garudaBalance,
        currentDues: item.currentDues,
        branchId: maharashtraBranch.id,
        createdById: superAdmin?.id ?? null,
        updatedById: superAdmin?.id ?? null,
      },
    });
    createdCount++;
  }

  console.log(`Successfully seeded ${createdCount} customer & project records under Maharashtra Branch!`);

  const totalCustomers = await prisma.customer.count({
    where: { branchId: maharashtraBranch.id, deletedAt: null },
  });
  console.log(`Total active customers in Maharashtra Branch: ${totalCustomers}`);
}

seedGarudaCustomers()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
