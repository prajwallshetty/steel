import type { Prisma } from "@prisma/client";
import type { Quotation, QuotationRowInput } from "@/types/quotation";

/**
 * Database row -> domain quotation.
 *
 * This mapper is the seam that let the ERP migration happen without touching
 * the pricing engine, the sheet component or the PDF renderer: they continue to
 * consume the exact `Quotation` shape they always have, and only this file
 * knows the shape came out of Postgres.
 *
 * `Decimal` is converted to `number` here. That is safe because the engine
 * re-normalises everything to 6dp on entry, and the values stored are already
 * within double precision — but the *storage* stays Decimal so no rounding
 * happens on the database side.
 */

export const QUOTATION_INCLUDE = {
  rows: { orderBy: { position: "asc" } },
  branch: { select: { id: true, name: true, code: true } },
  customer: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  approvedBy: { select: { name: true } },
  createdBy: { select: { name: true } },
} as const satisfies Prisma.QuotationInclude;

export type QuotationRecord = Prisma.QuotationGetPayload<{
  include: typeof QUOTATION_INCLUDE;
}>;

/** Prisma `Decimal | number | string` to a plain finite number. */
const toNumber = (value: Prisma.Decimal | number | string): number => {
  const parsed = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
};

export function toDomainRow(row: QuotationRecord["rows"][number]): QuotationRowInput {
  return {
    id: row.id,
    size: row.size,
    quantity: toNumber(row.quantity),
    basic: toNumber(row.basic),
    difference: toNumber(row.difference),
    loading: toNumber(row.loading),
    discountPercent: toNumber(row.discountPercent),
    gstPercent: toNumber(row.gstPercent),
    highlight: row.highlight,
  };
}

export function toDomainQuotation(record: QuotationRecord): Quotation {
  return {
    id: record.id,
    reference: record.reference,
    status: record.status,
    header: {
      title: record.title,
      date: record.quotationDate,
      location: record.location,
      partyName: record.partyName,
      brand: record.brand,
      basicRateLabel: record.basicRateLabel,
      diaDiffLabel: record.diaDiffLabel,
      payment: record.payment,
      cdType: record.cdType as any,
      vehicleNo: record.vehicleNo,
    },
    rows: record.rows.map(toDomainRow),
    remarks: record.remarks,
    createdBy: record.createdBy?.name ?? "System",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    ownership: {
      branchId: record.branch.id,
      branchName: record.branch.name,
      branchCode: record.branch.code,
      customerId: record.customerId,
      assignedToId: record.assignedToId,
      assignedToName: record.assignedTo?.name ?? null,
      approvedByName: record.approvedBy?.name ?? null,
      approvedAt: record.approvedAt?.toISOString() ?? null,
      rejectionReason: record.rejectionReason,
    },
  };
}
