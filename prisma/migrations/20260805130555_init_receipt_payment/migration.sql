-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'ACCOUNTANT';
ALTER TYPE "Role" ADD VALUE 'SALES';

-- AlterTable
ALTER TABLE "cash_ledger_entries" ADD COLUMN     "partyName" TEXT,
ADD COLUMN     "partyType" TEXT,
ADD COLUMN     "vendorBillId" TEXT;

-- CreateTable
CREATE TABLE "vendor_bills" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "billDate" DATE NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "vendor_bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_bills_branchId_deletedAt_idx" ON "vendor_bills"("branchId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_bills_branchId_billNumber_vendorName_key" ON "vendor_bills"("branchId", "billNumber", "vendorName");

-- AddForeignKey
ALTER TABLE "cash_ledger_entries" ADD CONSTRAINT "cash_ledger_entries_vendorBillId_fkey" FOREIGN KEY ("vendorBillId") REFERENCES "vendor_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
