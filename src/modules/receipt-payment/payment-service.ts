import "server-only";
import {
  AuditAction,
  LedgerDirection,
  LedgerStatus,
  NotificationType,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import { recordAudit } from "@/modules/audit/audit-service";
import { notifyBranchAdmins } from "@/modules/notifications/notification-service";
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
  branchWhere,
  type ScopeSubject,
} from "@/modules/permissions/scope";
import type { PaymentInput, VendorBillInput } from "./receipt-payment-schema";

const SETTLED: readonly LedgerStatus[] = [
  LedgerStatus.RECEIVED,
  LedgerStatus.CLEARED,
];

export interface PaymentRow {
  readonly id: string;
  readonly reference: string;
  readonly entryDate: string;
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
  readonly vendorBillId: string | null;
  readonly vendorBillNumber: string | null;
  readonly branchName: string;
  readonly createdByName: string;
  readonly createdAt: string;
}

export interface PaymentsPage {
  readonly rows: readonly PaymentRow[];
  readonly openingBalance: number;
  readonly closingBalance: number;
  readonly totalCredit: number;
  readonly totalDebit: number;
  readonly pendingAmount: number;
  readonly count: number;
}

function buildPaymentsWhere(
  subject: ScopeSubject,
  filters: {
    readonly search?: string;
    readonly from?: string;
    readonly to?: string;
    readonly status?: LedgerStatus;
    readonly paymentMethod?: string;
    readonly branchId?: string;
    readonly partyType?: string;
  },
): Prisma.CashLedgerEntryWhereInput {
  const conditions: Prisma.CashLedgerEntryWhereInput[] = [
    ledgerWhere(ledgerScope(subject)),
    NOT_DELETED,
    { direction: LedgerDirection.DEBIT }, // Payments are outgoing money
  ];

  if (filters.branchId) conditions.push({ branchId: filters.branchId });
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.paymentMethod) {
    conditions.push({ paymentMethod: filters.paymentMethod as any });
  }
  if (filters.partyType) conditions.push({ partyType: filters.partyType });
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
      ],
    });
  }

  return { AND: conditions };
}

// Compute cash + bank balances
async function computeOpeningCashBalance(
  subject: ScopeSubject,
  filters: { readonly from?: string; readonly branchId?: string },
): Promise<number> {
  if (!filters.from) return 0;

  const scoped = ledgerWhere(ledgerScope(subject));
  const priorWhere = {
    AND: [
      scoped,
      NOT_DELETED,
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

export async function listPayments(
  subject: ScopeSubject,
  filters: {
    readonly search?: string;
    readonly from?: string;
    readonly to?: string;
    readonly status?: LedgerStatus;
    readonly paymentMethod?: string;
    readonly branchId?: string;
    readonly partyType?: string;
  } = {},
): Promise<PaymentsPage> {
  const where = buildPaymentsWhere(subject, filters);

  const [entries, openingBalance] = await Promise.all([
    prisma.cashLedgerEntry.findMany({
      where,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      include: {
        customer: { select: { name: true } },
        vendorBill: { select: { billNumber: true } },
        branch: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      take: 500,
    }),
    computeOpeningCashBalance(subject, { from: filters.from, branchId: filters.branchId }),
  ]);

  // Compute period aggregates for the bottom card
  const scoped = ledgerWhere(ledgerScope(subject));
  const periodBase = {
    AND: [
      scoped,
      NOT_DELETED,
      filters.branchId ? { branchId: filters.branchId } : {},
      filters.from ? { entryDate: { gte: new Date(filters.from) } } : {},
      filters.to ? { entryDate: { lte: new Date(filters.to) } } : {},
      { status: { in: [...SETTLED] } },
    ],
  };

  const [periodCredits, periodDebits, pendingPayments] = await Promise.all([
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
          filters.branchId ? { branchId: filters.branchId } : {},
          { direction: LedgerDirection.DEBIT },
          { status: LedgerStatus.PENDING },
        ],
      },
    }),
  ]);

  const totalCredit = Number(periodCredits._sum?.amount ?? 0);
  const totalDebit = Number(periodDebits._sum?.amount ?? 0);
  const closingBalance = openingBalance + totalCredit - totalDebit;

  const rows: PaymentRow[] = entries.map((entry) => {
    return {
      id: entry.id,
      reference: entry.reference,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
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
      vendorBillId: entry.vendorBillId,
      vendorBillNumber: entry.vendorBill?.billNumber ?? null,
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
    pendingAmount: Number(pendingPayments._sum?.amount ?? 0),
    count: rows.length,
  };
}

export async function createPayment(
  subject: ScopeSubject,
  input: PaymentInput,
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

  const status = LedgerStatus.RECEIVED;

  const year = Number(input.entryDate.slice(0, 4));

  const entry = await prisma.$transaction(async (tx) => {
    const serial = await nextSequenceValue(branchId, "PAYMENT", year, tx);
    return tx.cashLedgerEntry.create({
      data: {
        reference: formatReference(branch.code, "PAYMENT", year, serial),
        entryDate: new Date(input.entryDate),
        branchId,
        customerId: input.customerId || null,
        vendorBillId: input.vendorBillId || null,
        partyType: input.partyType,
        partyName: input.partyName,
        direction: LedgerDirection.DEBIT,
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

  await recordAudit({
    action: AuditAction.CREATE,
    entity: "CashLedgerEntry",
    entityId: entry.id,
    summary: `Recorded payment of ${input.amount} to ${input.partyName} (${entry.reference})`,
    userId: subject.id,
    branchId,
    newValue: {
      amount: input.amount,
      partyName: input.partyName,
      partyType: input.partyType,
      method: input.paymentMethod,
      status,
    },
  });



  return { id: entry.id };
}

export async function deletePayment(
  subject: ScopeSubject,
  id: string,
): Promise<void> {
  if (!hasPermission(subject, PERMISSIONS.LEDGER_DELETE)) {
    throw new ForbiddenError("You do not have permission to delete payments.");
  }

  const existing = await prisma.cashLedgerEntry.findFirst({
    where: { id, direction: LedgerDirection.DEBIT, ...NOT_DELETED },
  });
  if (!existing) throw new RecordNotFoundError("Payment");

  if (existing.status === LedgerStatus.CLEARED) {
    throw new BusinessRuleError(
      "A cleared payment cannot be deleted. Post a reversing entry instead.",
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
    summary: `Deleted payment ${existing.reference}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { amount: Number(existing.amount), status: existing.status, partyName: existing.partyName },
  });
}

// Vendor Bills functions
export async function listVendorBills(
  subject: ScopeSubject,
  filters: { readonly search?: string; readonly branchId?: string } = {},
): Promise<any[]> {
  const branchCond = subject.role === Role.SUPER_ADMIN
    ? (filters.branchId ? { branchId: filters.branchId } : {})
    : { branchId: subject.branchId ?? "__none__" };

  const bills = await prisma.vendorBill.findMany({
    where: {
      AND: [
        branchCond,
        NOT_DELETED,
        filters.search?.trim()
          ? {
              OR: [
                { billNumber: { contains: filters.search.trim(), mode: "insensitive" } },
                { vendorName: { contains: filters.search.trim(), mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    include: {
      ledgerEntries: {
        where: {
          AND: [
            NOT_DELETED,
            { status: { in: [...SETTLED] } },
            { direction: LedgerDirection.DEBIT },
          ],
        },
        select: { amount: true },
      },
    },
    orderBy: { billDate: "desc" },
  });

  return bills.map((bill) => {
    const amount = Number(bill.amount);
    const paidAmount = bill.ledgerEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const dueAmount = Math.max(0, amount - paidAmount);

    return {
      id: bill.id,
      billNumber: bill.billNumber,
      vendorName: bill.vendorName,
      amount,
      paidAmount,
      dueAmount,
      billDate: bill.billDate.toISOString().slice(0, 10),
      status: dueAmount === 0 ? "PAID" : dueAmount === amount ? "UNPAID" : "PARTIALLY_PAID",
    };
  });
}

export async function createVendorBill(
  subject: ScopeSubject,
  input: VendorBillInput,
): Promise<{ id: string }> {
  const branchId = resolveWriteBranch(subject, input.branchId || null);

  const bill = await prisma.vendorBill.create({
    data: {
      billNumber: input.billNumber.trim(),
      vendorName: input.vendorName.trim(),
      amount: new Prisma.Decimal(input.amount),
      billDate: new Date(input.billDate),
      branchId,
      createdById: subject.id,
      updatedById: subject.id,
    },
  });

  await recordAudit({
    action: AuditAction.CREATE,
    entity: "VendorBill",
    entityId: bill.id,
    summary: `Created vendor bill ${bill.billNumber} for ${bill.vendorName} (₹${input.amount})`,
    userId: subject.id,
    branchId,
    newValue: {
      billNumber: bill.billNumber,
      vendorName: bill.vendorName,
      amount: input.amount,
    },
  });

  return { id: bill.id };
}

// Ledgers Calculations
export async function getVendorLedger(
  subject: ScopeSubject,
  vendorName: string,
  filters: { readonly from?: string; readonly to?: string; readonly branchId?: string } = {},
): Promise<any> {
  const branchId = subject.role === Role.SUPER_ADMIN ? filters.branchId : subject.branchId;

  const branchCond = branchId ? { branchId } : {};

  // Fetch all bills for this vendor
  const bills = await prisma.vendorBill.findMany({
    where: {
      AND: [
        branchCond,
        NOT_DELETED,
        { vendorName: { equals: vendorName, mode: "insensitive" } },
        filters.from ? { billDate: { gte: new Date(filters.from) } } : {},
        filters.to ? { billDate: { lte: new Date(filters.to) } } : {},
      ],
    },
    orderBy: { billDate: "asc" },
  });

  // Fetch all payments made to this vendor
  const payments = await prisma.cashLedgerEntry.findMany({
    where: {
      AND: [
        branchCond,
        NOT_DELETED,
        { direction: LedgerDirection.DEBIT },
        { status: { in: [...SETTLED] } },
        { partyType: "VENDOR" },
        { partyName: { equals: vendorName, mode: "insensitive" } },
        filters.from ? { entryDate: { gte: new Date(filters.from) } } : {},
        filters.to ? { entryDate: { lte: new Date(filters.to) } } : {},
      ],
    },
    orderBy: { entryDate: "asc" },
  });

  // Combine and sort chronologically
  const ledgerItems: any[] = [];

  bills.forEach((bill) => {
    ledgerItems.push({
      id: bill.id,
      date: bill.billDate.toISOString().slice(0, 10),
      voucherNo: bill.billNumber,
      description: `Purchase Bill — ${bill.billNumber}`,
      debit: 0,
      credit: Number(bill.amount), // Vendor credit increases balance owed
      type: "BILL",
    });
  });

  payments.forEach((pmt) => {
    ledgerItems.push({
      id: pmt.id,
      date: pmt.entryDate.toISOString().slice(0, 10),
      voucherNo: pmt.reference,
      description: pmt.particular,
      debit: Number(pmt.amount), // Payment decreases balance owed
      credit: 0,
      type: "PAYMENT",
    });
  });

  ledgerItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balance
  let balance = 0;
  const rows = ledgerItems.map((item) => {
    balance += item.credit - item.debit;
    return {
      ...item,
      balance,
    };
  });

  return {
    vendorName,
    openingBalance: 0, // We could compute opening balance prior to filter range
    closingBalance: balance,
    rows,
  };
}

export async function getEmployeeLedger(
  subject: ScopeSubject,
  employeeName: string,
  filters: { readonly from?: string; readonly to?: string; readonly branchId?: string } = {},
): Promise<any> {
  const branchId = subject.role === Role.SUPER_ADMIN ? filters.branchId : subject.branchId;
  const branchCond = branchId ? { branchId } : {};

  const payments = await prisma.cashLedgerEntry.findMany({
    where: {
      AND: [
        branchCond,
        NOT_DELETED,
        { direction: LedgerDirection.DEBIT },
        { status: { in: [...SETTLED] } },
        { partyType: "EMPLOYEE" },
        { partyName: { equals: employeeName, mode: "insensitive" } },
        filters.from ? { entryDate: { gte: new Date(filters.from) } } : {},
        filters.to ? { entryDate: { lte: new Date(filters.to) } } : {},
      ],
    },
    orderBy: { entryDate: "asc" },
  });

  let running = 0;
  const rows = payments.map((pmt) => {
    const amount = Number(pmt.amount);
    running += amount;
    return {
      id: pmt.id,
      date: pmt.entryDate.toISOString().slice(0, 10),
      voucherNo: pmt.reference,
      description: pmt.particular,
      debit: amount,
      credit: 0,
      balance: running,
    };
  });

  return {
    employeeName,
    totalPaid: running,
    rows,
  };
}

// Helpers for distinct searchable drop downs
export async function getDistinctVendors(subject: ScopeSubject): Promise<string[]> {
  const branchWhereCond = branchWhere(subject);

  const [distinctFromEntries, distinctFromBills] = await Promise.all([
    prisma.cashLedgerEntry.findMany({
      where: {
        AND: [
          branchWhereCond,
          NOT_DELETED,
          { partyType: "VENDOR" },
          { partyName: { not: null } },
        ],
      },
      select: { partyName: true },
      distinct: ["partyName"],
    }),
    prisma.vendorBill.findMany({
      where: {
        AND: [
          branchWhereCond,
          NOT_DELETED,
        ],
      },
      select: { vendorName: true },
      distinct: ["vendorName"],
    }),
  ]);

  const names = new Set<string>();
  distinctFromEntries.forEach((e) => {
    if (e.partyName) names.add(e.partyName.trim());
  });
  distinctFromBills.forEach((b) => {
    names.add(b.vendorName.trim());
  });

  return Array.from(names).sort();
}

export async function getDistinctEmployees(subject: ScopeSubject): Promise<string[]> {
  const branchWhereCond = branchWhere(subject);

  const distinctFromEntries = await prisma.cashLedgerEntry.findMany({
    where: {
      AND: [
        branchWhereCond,
        NOT_DELETED,
        { partyType: "EMPLOYEE" },
        { partyName: { not: null } },
      ],
    },
    select: { partyName: true },
    distinct: ["partyName"],
  });

  const names = distinctFromEntries
    .map((e) => e.partyName?.trim())
    .filter((n): n is string => Boolean(n));

  return Array.from(new Set(names)).sort();
}
