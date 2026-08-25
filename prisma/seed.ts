import { PrismaClient, Prisma, QuotationStatus, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Database seed.
 *
 * Builds the organisation described in the brief — a Super Admin over two
 * branches, each with an admin and two managers — plus the reference quotation
 * transcribed from the original workbook, so the printed sheet can be compared
 * against it immediately.
 *
 * Idempotent: every write is an upsert keyed on a natural unique column, so
 * running it twice is safe and will not duplicate the organisation.
 */

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
    /* rely on the ambient environment */
  }
}

loadEnv();

const connectionString = process.env.DB_URL;
if (!connectionString) throw new Error("DB_URL is not set.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/**
 * Development credentials.
 *
 * Deliberately obvious and printed at the end of the run. Override with
 * SEED_PASSWORD in any environment that is reachable by anyone else, and
 * rotate them before the system carries real data.
 */
const PASSWORD = process.env.SEED_PASSWORD ?? "ChangeMe123";

const BRANCHES = [
  { code: "MNG", name: "Mangalore", state: "Karnataka", gstNumber: "29ABCDE1234F1Z5", startingBalance: 50000 },
  { code: "MAH", name: "Maharashtra", state: "Maharashtra", gstNumber: "27ABCDE1234F1Z5", startingBalance: 75000 },
] as const;

async function main() {
  console.log("Seeding…");
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // --- Super Admin: created first so it can own everything that follows -----
  const superAdmin = await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {},
    create: {
      name: "Super Admin",
      username: "superadmin",
      email: "superadmin@steel.local",
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: "ACTIVE",
      branchId: null,
    },
  });

  // --- Branches ------------------------------------------------------------
  const branches = [];
  for (const branch of BRANCHES) {
    branches.push(
      await prisma.branch.upsert({
        where: { code: branch.code },
        update: {
          startingBalance: new Prisma.Decimal(branch.startingBalance),
        },
        create: {
          ...branch,
          startingBalance: new Prisma.Decimal(branch.startingBalance),
          phone: "+91 80 4000 0000",
          email: `${branch.code.toLowerCase()}@steel.local`,
          status: "ACTIVE",
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      }),
    );
  }

  // --- Branch admins and managers -----------------------------------------
  const created: { username: string; role: string; branch: string }[] = [];

  for (const branch of branches) {
    const slug = branch.name.toLowerCase();

    const admin = await prisma.user.upsert({
      where: { username: `${slug}.admin` },
      update: {},
      create: {
        name: `${branch.name} Admin`,
        username: `${slug}.admin`,
        email: `admin@${branch.code.toLowerCase()}.steel.local`,
        passwordHash,
        role: Role.BRANCH_ADMIN,
        status: "ACTIVE",
        branchId: branch.id,
        createdById: superAdmin.id,
        updatedById: superAdmin.id,
      },
    });
    created.push({ username: admin.username, role: "Branch Admin", branch: branch.name });

    for (const index of [1, 2]) {
      const manager = await prisma.user.upsert({
        where: { username: `${slug}.manager${index}` },
        update: {},
        create: {
          name: `${branch.name} Manager ${index}`,
          username: `${slug}.manager${index}`,
          email: `manager${index}@${branch.code.toLowerCase()}.steel.local`,
          passwordHash,
          role: Role.MANAGER,
          status: "ACTIVE",
          branchId: branch.id,
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
      created.push({ username: manager.username, role: "Manager", branch: branch.name });
    }
  }

  // --- Global master settings ---------------------------------------------
  const existingSettings = await prisma.systemSetting.findFirst({
    where: { branchId: null },
  });
  if (!existingSettings) {
    const { DEFAULT_SETTINGS } = await import("../src/lib/settings/defaults");
    await prisma.systemSetting.create({
      data: {
        branchId: null,
        data: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue,
        updatedById: superAdmin.id,
      },
    });
    console.log("  · master settings created");
  }

  // --- Reference quotation, transcribed from the supplied workbook ---------
  const mangalore = branches[0];
  const manager = await prisma.user.findUnique({
    where: { username: "mangalore.manager1" },
  });

  let customer = await prisma.customer.findFirst({
    where: { branchId: mangalore.id, name: "SADGURU TRADERS" },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: "SADGURU TRADERS",
        phone: "+91 98450 00000",
        gstNumber: "29SADGU1234F1Z5",
        city: "Ghotwade",
        state: "Karnataka",
        branchId: mangalore.id,
        createdById: manager?.id ?? superAdmin.id,
        updatedById: manager?.id ?? superAdmin.id,
      },
    });
  }

  const reference = "MNG/QT/2026/0001";
  const existingQuotation = await prisma.quotation.findUnique({
    where: { reference },
  });

  if (!existingQuotation) {
    // Sizes, quantities and rates exactly as printed on the source sheet.
    const rows = [
      { size: "8MM", quantity: 1.99, basic: 36300, difference: 6500 },
      { size: "10MM", quantity: 7.1, basic: 36300, difference: 5500 },
      { size: "12MM", quantity: 3.09, basic: 36300, difference: 5500 },
      { size: "16MM", quantity: 0, basic: 0, difference: 5500 },
      { size: "20MM", quantity: 0, basic: 0, difference: 5500 },
      { size: "25MM", quantity: 0, basic: 0, difference: 5500 },
      { size: "32MM", quantity: 0, basic: 0, difference: 6500 },
      { size: "6MM", quantity: 0, basic: 0, difference: 0, loading: 0 },
    ];

    await prisma.quotation.create({
      data: {
        reference,
        status: QuotationStatus.APPROVED,
        branchId: mangalore.id,
        customerId: customer.id,
        assignedToId: manager?.id ?? null,
        title: "DISCOUNT/CD",
        quotationDate: "2026-07-07",
        location: "GHOTWADE",
        partyName: "SADGURU TRADERS",
        brand: "SHIRDI",
        basicRateLabel: "40300-4000-R",
        diaDiffLabel: "6500/5500 +295",
        payment: "REGULER",
        vehicleNo: "",
        remarks: "PLEASE CHECK ONCE AND RE-CONFIRM IF ANY MISTAKE.",
        // The figure printed in red on the original sheet.
        grandTotal: new Prisma.Decimal(607354),
        totalQuantity: new Prisma.Decimal(12.18),
        approvedById: superAdmin.id,
        approvedAt: new Date("2026-07-07T05:00:00.000Z"),
        createdById: manager?.id ?? superAdmin.id,
        updatedById: manager?.id ?? superAdmin.id,
        rows: {
          create: rows.map((row, position) => ({
            position,
            size: row.size,
            quantity: new Prisma.Decimal(row.quantity),
            basic: new Prisma.Decimal(row.basic),
            difference: new Prisma.Decimal(row.difference),
            loading: new Prisma.Decimal(row.loading ?? 295),
            // The sheet advertises 1.5% CD but charges none: term is REGULER.
            discountPercent: new Prisma.Decimal(0),
            gstPercent: new Prisma.Decimal(18),
            highlight: null,
          })),
        },
      },
    });

    // Keep the sequence in step so the next quotation is 0002, not 0001.
    await prisma.sequence.upsert({
      where: {
        branchId_kind_year: {
          branchId: mangalore.id,
          kind: "QUOTATION",
          year: 2026,
        },
      },
      update: { value: 1 },
      create: {
        branchId: mangalore.id,
        kind: "QUOTATION",
        year: 2026,
        value: 1,
      },
    });

    console.log(`  · reference quotation ${reference} created`);
  }

  console.log(`\nSeed complete. ${created.length + 1} users.\n`);
  console.table([
    { username: "superadmin", role: "Super Admin", branch: "All branches" },
    ...created,
  ]);
  console.log(`\nPassword for every account: ${PASSWORD}`);
  console.log("Change these before the system carries real data.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
