import "server-only";
import {
  AuditAction,
  LedgerDirection,
  LedgerStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import { diffFields, recordAudit } from "@/modules/audit/audit-service";
import { formatReference, nextSequenceValue } from "@/modules/shared/sequence";
import {
  BusinessRuleError,
  RecordNotFoundError,
} from "@/modules/shared/action-result";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import {
  ForbiddenError,
  canMutateRecord,
  ledgerScope,
  ledgerWhere,
  resolveWriteBranch,
  type ScopeSubject,
} from "@/modules/permissions/scope";
import type { PartnerPaymentInput } from "./receipt-payment-schema";

const SETTLED: readonly LedgerStatus[] = [
  LedgerStatus.RECEIVED,
  LedgerStatus.CLEARED,
];

export interface PartnerPaymentRow {
  readonly id: string;
  readonly reference: string;
  readonly entryDate: string;
  readonly direction: LedgerDirection;
  readonly partyType: string;
  readonly partyName: string;
  readonly amount: number;
  readonly paymentMethod: string;
  readonly referenceNo: string | null;
  readonly particular: string;
  readonly note: string | null;
  readonly status: LedgerStatus;
  readonly customerId: string | null;
  readonly customerName: string | null;
  readonly vendorId: string | null;
  readonly vendorName: string | null;
  readonly branchName: string;
  readonly createdByName: string;
  readonly createdAt: string;
}

export interface PartnerPaymentsPage {
  readonly rows: readonly PartnerPaymentRow[];
  readonly openingBalance: number;
  readonly closingBalance: number;
  readonly totalCredit: number; // Receipts (Money In)
  readonly totalDebit: number;  // Payments (Money Out)
  readonly pendingAmount: number;
  readonly count: number;
}

function buildPartnerPaymentsWhere(
  subject: ScopeSubject,
  partnerType: "CUSTOMER" | "VENDOR",
  filters: {
    readonly search?: string;
    readonly from?: string;
    readonly to?: string;
    readonly status?: LedgerStatus;
    readonly paymentMethod?: string;
    readonly branchId?: string;
    readonly direction?: LedgerDirection;
  },
): Prisma.CashLedgerEntryWhereInput {
  const partnerCondition = partnerType === "CUSTOMER"
    ? {
        OR: [
          { customerId: { not: null } },
          { partyType: "CUSTOMER" },
        ],
      }
    : {
        OR: [
          { vendorId: { not: null } },
          { partyType: "VENDOR" },
        ],
      };

  const conditions: Prisma.CashLedgerEntryWhereInput[] = [
    ledgerWhere(ledgerScope(subject)),
    NOT_DELETED,
    partnerCondition,
  ];

  if (filters.branchId) conditions.push({ branchId: filters.branchId });
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.direction) conditions.push({ direction: filters.direction });
  if (filters.paymentMethod) {
    conditions.push({ paymentMethod: filters.paymentMethod as any });
  }
  if (filters.from) conditions.push({ entryDate: { gte: new Date(filters.from) } });
  if (filters.to) conditions.push({ entryDate: { lte: new Date(filters.to) } });

  if (filters.search?.trim()) {
    const term = filters.search.trim();
    conditions.push({
      OR: [
        { reference: { contains: term, mode: "insensitive" } },
        { referenceNo: { contains: term, mode: "insensitive" } },
        { particular: { contains: term, mode: "insensitive" } },
        { note: { contains: term, mode: "insensitive" } },
        { partyName: { contains: term, mode: "insensitive" } },
        { customer: { name: { contains: term, mode: "insensitive" } } },
        { vendor: { name: { contains: term, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: conditions };
}

async function computeOpeningCashBalance(
  subject: ScopeSubject,
  partnerType: "CUSTOMER" | "VENDOR",
  filters: { readonly from?: string; readonly branchId?: string },
): Promise<number> {
  if (!filters.from) return 0;

  const scoped = ledgerWhere(ledgerScope(subject));
  const partnerCondition = partnerType === "CUSTOMER"
    ? {
        OR: [
          { customerId: { not: null } },
          { partyType: "CUSTOMER" },
        ],
      }
    : {
        OR: [
          { vendorId: { not: null } },
          { partyType: "VENDOR" },
        ],
      };

  const priorWhere = {
    AND: [
      scoped,
      NOT_DELETED,
      partnerCondition,
      filters.branchId ? { branchId: filters.branchId } : {},
      { entryDate: { lt: new Date(filters.from) } },
      { status: { in: [...SETTLED] } },
    ],
  };

  const [credits, debits] = await Promise.all([
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: { AND: [priorWhere, { direction: LedgerDirection.CREDIT }] },
    }),
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: { AND: [priorWhere, { direction: LedgerDirection.DEBIT }] },
    }),
  ]);

  return (
    Number(credits._sum?.amount ?? 0) - Number(debits._sum?.amount ?? 0)
  );
}

export async function listPartnerPayments(
  subject: ScopeSubject,
  partnerType: "CUSTOMER" | "VENDOR",
  filters: {
    readonly search?: string;
    readonly from?: string;
    readonly to?: string;
    readonly status?: LedgerStatus;
    readonly paymentMethod?: string;
    readonly branchId?: string;
    readonly direction?: LedgerDirection;
  } = {},
): Promise<PartnerPaymentsPage> {
  const where = buildPartnerPaymentsWhere(subject, partnerType, filters);

  const [entries, openingBalance] = await Promise.all([
    prisma.cashLedgerEntry.findMany({
      where,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      include: {
        customer: { select: { name: true } },
        vendor: { select: { name: true } },
        branch: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      take: 500,
    }),
    computeOpeningCashBalance(subject, partnerType, { from: filters.from, branchId: filters.branchId }),
  ]);

  // Compute period aggregates for the UI cards
  const scoped = ledgerWhere(ledgerScope(subject));
  const partnerCondition = partnerType === "CUSTOMER"
    ? {
        OR: [
          { customerId: { not: null } },
          { partyType: "CUSTOMER" },
        ],
      }
    : {
        OR: [
          { vendorId: { not: null } },
          { partyType: "VENDOR" },
        ],
      };

  const periodBase = {
    AND: [
      scoped,
      NOT_DELETED,
      partnerCondition,
      filters.branchId ? { branchId: filters.branchId } : {},
      filters.from ? { entryDate: { gte: new Date(filters.from) } } : {},
      filters.to ? { entryDate: { lte: new Date(filters.to) } } : {},
      { status: { in: [...SETTLED] } },
    ],
  };

  const [periodCredits, periodDebits, pendingAgg] = await Promise.all([
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: { AND: [periodBase, { direction: LedgerDirection.CREDIT }] },
    }),
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: { AND: [periodBase, { direction: LedgerDirection.DEBIT }] },
    }),
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          scoped,
          NOT_DELETED,
          partnerCondition,
          filters.branchId ? { branchId: filters.branchId } : {},
          { status: LedgerStatus.PENDING },
        ],
      },
    }),
  ]);

  const totalCredit = Number(periodCredits._sum?.amount ?? 0);
  const totalDebit = Number(periodDebits._sum?.amount ?? 0);
  const closingBalance = openingBalance + totalCredit - totalDebit;

  const rows: PartnerPaymentRow[] = entries.map((entry) => {
    return {
      id: entry.id,
      reference: entry.reference,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      direction: entry.direction,
      partyType: entry.partyType ?? "OTHERS",
      partyName: entry.partyName ?? entry.particular,
      amount: Number(entry.amount),
      paymentMethod: entry.paymentMethod,
      referenceNo: entry.referenceNo,
      particular: entry.particular,
      note: entry.note,
      status: entry.status,
      customerId: entry.customerId,
      customerName: entry.customer?.name ?? null,
      vendorId: entry.vendorId,
      vendorName: entry.vendor?.name ?? null,
      branchName: entry.branch.name,
      createdByName: entry.createdBy?.name ?? "System",
      createdAt: entry.createdAt.toISOString(),
    };
  });

  return {
    rows,
    openingBalance,
    closingBalance,
    totalCredit,
    totalDebit,
    pendingAmount: Number(pendingAgg._sum?.amount ?? 0),
    count: rows.length,
  };
}

export async function createPartnerPayment(
  subject: ScopeSubject,
  input: PartnerPaymentInput,
): Promise<{ id: string }> {
  const branchId = resolveWriteBranch(subject, input.branchId || null);

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, ...NOT_DELETED },
    select: { code: true, name: true, status: true },
  });
  if (!branch) throw new RecordNotFoundError("Branch");
  if (branch.status !== "ACTIVE") {
    throw new BusinessRuleError(`Branch ${branch.name} is not active.`);
  }

  // Resolve partner name
  let partnerName = "";
  if (input.partnerType === "CUSTOMER") {
    const cust = await prisma.customer.findFirst({
      where: { id: input.partnerId, branchId, ...NOT_DELETED },
      select: { name: true },
    });
    if (!cust) throw new RecordNotFoundError("Customer");
    partnerName = cust.name;
  } else {
    const vend = await prisma.vendor.findFirst({
      where: { id: input.partnerId, branchId, ...NOT_DELETED },
      select: { name: true },
    });
    if (!vend) throw new RecordNotFoundError("Vendor");
    partnerName = vend.name;
  }

  const status = LedgerStatus.RECEIVED;
  const year = Number(input.entryDate.slice(0, 4));
  const seqType = input.direction === LedgerDirection.CREDIT ? "RECEIPT" : "PAYMENT";

  const entry = await prisma.$transaction(async (tx) => {
    const serial = await nextSequenceValue(branchId, seqType, year, tx);
    return tx.cashLedgerEntry.create({
      data: {
        reference: formatReference(branch.code, seqType, year, serial),
        entryDate: new Date(input.entryDate),
        branchId,
        customerId: input.partnerType === "CUSTOMER" ? input.partnerId : null,
        vendorId: input.partnerType === "VENDOR" ? input.partnerId : null,
        partyType: input.partnerType,
        partyName: partnerName,
        direction: input.direction,
        amount: new Prisma.Decimal(input.amount),
        paymentMethod: input.paymentMethod as any,
        referenceNo: input.referenceNo?.trim() || null,
        particular: input.particular.trim(),
        note: input.note?.trim() || null,
        status,
        approvedById: subject.id,
        approvedAt: new Date(),
        createdById: subject.id,
        updatedById: subject.id,
      },
    });
  });

  const auditSummary = input.direction === LedgerDirection.CREDIT
    ? `Recorded receipt of ${input.amount} from ${partnerName} (${entry.reference})`
    : `Recorded payment of ${input.amount} to ${partnerName} (${entry.reference})`;

  await recordAudit({
    action: AuditAction.CREATE,
    entity: "CashLedgerEntry",
    entityId: entry.id,
    summary: auditSummary,
    userId: subject.id,
    branchId,
    newValue: {
      amount: input.amount,
      partyName: partnerName,
      partyType: input.partnerType,
      direction: input.direction,
      method: input.paymentMethod,
      status,
    },
  });

  return { id: entry.id };
}

/**
 * Edit an existing vendor/customer payment in place.
 *
 * Updates the `CashLedgerEntry` row by its id — never creates a second entry.
 * The branch assignment is never touched: a payment stays attributed to the
 * branch it was recorded in regardless of what the submitted form carries,
 * so this can't be used to move a voucher between Maharashtra and Mangalore.
 * All downstream figures (vendor outstanding, ledger, dashboard, totals) are
 * computed live from this table, so updating the row is sufficient for them
 * to reflect the edit — no separate recalculation step is needed.
 */
export async function updatePartnerPayment(
  subject: ScopeSubject,
  id: string,
  input: PartnerPaymentInput,
): Promise<{ id: string }> {
  const existing = await prisma.cashLedgerEntry.findFirst({
    where: { AND: [{ id }, ledgerWhere(ledgerScope(subject)), NOT_DELETED] },
  });
  if (!existing) throw new RecordNotFoundError("Payment");

  const mayEdit = canMutateRecord(ledgerScope(subject), {
    branchId: existing.branchId,
    ownerIds: [existing.createdById],
  });
  if (!mayEdit) {
    throw new ForbiddenError("You can only edit payments you are authorized for.");
  }

  // A cleared entry has been reconciled; changing it would silently rewrite a
  // balance somebody has already signed off on.
  if (existing.status === LedgerStatus.CLEARED && !hasPermission(subject, PERMISSIONS.LEDGER_APPROVE)) {
    throw new BusinessRuleError(
      "This payment is cleared and reconciled. Ask an administrator to amend it.",
    );
  }

  const existingPartnerType: "CUSTOMER" | "VENDOR" =
    existing.customerId || existing.partyType === "CUSTOMER" ? "CUSTOMER" : "VENDOR";
  if (input.partnerType !== existingPartnerType) {
    throw new BusinessRuleError(
      "A payment's party type (customer/vendor) cannot be changed. Delete it and create a new entry instead.",
    );
  }

  // Branch assignment is immutable on edit — always the branch the payment was
  // originally recorded against, never whatever the client submits.
  const branchId = existing.branchId;

  // Re-resolve the partner, scoped to the (unchangeable) branch. This both
  // validates a changed vendor/customer safely — the same way create does —
  // and keeps `partyName` in sync, since the vendor ledger view matches on
  // that name rather than the FK.
  let partnerName = "";
  if (input.partnerType === "CUSTOMER") {
    const cust = await prisma.customer.findFirst({
      where: { id: input.partnerId, branchId, ...NOT_DELETED },
      select: { name: true },
    });
    if (!cust) throw new RecordNotFoundError("Customer");
    partnerName = cust.name;
  } else {
    const vend = await prisma.vendor.findFirst({
      where: { id: input.partnerId, branchId, ...NOT_DELETED },
      select: { name: true },
    });
    if (!vend) throw new RecordNotFoundError("Vendor");
    partnerName = vend.name;
  }

  const data = {
    entryDate: new Date(input.entryDate),
    customerId: input.partnerType === "CUSTOMER" ? input.partnerId : null,
    vendorId: input.partnerType === "VENDOR" ? input.partnerId : null,
    partyName: partnerName,
    direction: input.direction,
    amount: new Prisma.Decimal(input.amount),
    paymentMethod: input.paymentMethod as any,
    referenceNo: input.referenceNo?.trim() || null,
    particular: input.particular.trim(),
    note: input.note?.trim() || null,
  };

  // Update the existing row by id — the payment ID is preserved and no new
  // record is created.
  await prisma.cashLedgerEntry.update({
    where: { id },
    data: { ...data, updatedById: subject.id },
  });

  const changes = diffFields(
    {
      entryDate: existing.entryDate,
      customerId: existing.customerId,
      vendorId: existing.vendorId,
      partyName: existing.partyName,
      direction: existing.direction,
      amount: existing.amount,
      paymentMethod: existing.paymentMethod,
      referenceNo: existing.referenceNo,
      particular: existing.particular,
      note: existing.note,
    },
    data,
  );

  if (changes) {
    await recordAudit({
      action: AuditAction.UPDATE,
      entity: "CashLedgerEntry",
      entityId: id,
      summary: `Updated ${input.direction === LedgerDirection.CREDIT ? "receipt" : "payment"} ${existing.reference} for ${partnerName}`,
      userId: subject.id,
      branchId,
      oldValue: changes.before,
      newValue: changes.after,
    });
  }

  return { id };
}

export async function deletePartnerPayment(
  subject: ScopeSubject,
  id: string,
): Promise<void> {
  if (!hasPermission(subject, PERMISSIONS.LEDGER_DELETE)) {
    throw new ForbiddenError("You do not have permission to delete ledger entries.");
  }

  const existing = await prisma.cashLedgerEntry.findFirst({
    where: { id, ...NOT_DELETED },
  });
  if (!existing) throw new RecordNotFoundError("Ledger Entry");

  if (existing.status === LedgerStatus.CLEARED) {
    throw new BusinessRuleError(
      "A cleared ledger entry cannot be deleted. Post a reversing entry instead.",
    );
  }

  await prisma.cashLedgerEntry.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: subject.id },
  });

  await recordAudit({
    action: AuditAction.DELETE,
    entity: "CashLedgerEntry",
    entityId: id,
    summary: `Deleted ledger entry ${existing.reference}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { amount: Number(existing.amount), status: existing.status, partyName: existing.partyName },
  });
}
