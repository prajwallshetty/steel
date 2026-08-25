import "server-only";
import {
  AuditAction,
  LedgerDirection,
  LedgerStatus,
  NotificationType,
  Prisma,
  QuotationStatus,
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
import type { ReceiptInput } from "./receipt-payment-schema";

const SETTLED: readonly LedgerStatus[] = [
  LedgerStatus.RECEIVED,
  LedgerStatus.CLEARED,
];

const INVOICE_STATUSES: readonly QuotationStatus[] = [
  QuotationStatus.APPROVED,
  QuotationStatus.COMPLETED,
];

export interface ReceiptRow {
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
  readonly quotationId: string | null;
  readonly quotationReference: string | null;
  readonly branchName: string;
  readonly createdByName: string;
  readonly createdAt: string;
}

export interface ReceiptsPage {
  readonly rows: readonly ReceiptRow[];
  readonly openingBalance: number;
  readonly closingBalance: number;
  readonly totalCredit: number;
  readonly totalDebit: number;
  readonly pendingAmount: number;
  readonly count: number;
}

function buildReceiptsWhere(
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
  // If the user has a Sales role, they can only view customer receipts.
  const partyTypeFilter = subject.role === Role.SALES 
    ? "CUSTOMER" 
    : filters.partyType;

  const conditions: Prisma.CashLedgerEntryWhereInput[] = [
    ledgerWhere(ledgerScope(subject)),
    NOT_DELETED,
    { direction: LedgerDirection.CREDIT }, // Receipts are incoming money
  ];

  if (filters.branchId) conditions.push({ branchId: filters.branchId });
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.paymentMethod) {
    conditions.push({ paymentMethod: filters.paymentMethod as any });
  }
  if (partyTypeFilter) conditions.push({ partyType: partyTypeFilter });
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

// Compute cash + bank balances (credits - debits) prior to a specific date
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

export async function listReceipts(
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
): Promise<ReceiptsPage> {
  const where = buildReceiptsWhere(subject, filters);

  const [entries, openingBalance] = await Promise.all([
    prisma.cashLedgerEntry.findMany({
      where,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      include: {
        customer: { select: { name: true } },
        quotation: { select: { reference: true } },
        branch: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      take: 500,
    }),
    computeOpeningCashBalance(subject, { from: filters.from, branchId: filters.branchId }),
  ]);

  // Compute period aggregates for reporting
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

  const [periodCredits, periodDebits, pendingReceipts] = await Promise.all([
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
          { direction: LedgerDirection.CREDIT },
          { status: LedgerStatus.PENDING },
        ],
      },
    }),
  ]);

  const totalCredit = Number(periodCredits._sum?.amount ?? 0);
  const totalDebit = Number(periodDebits._sum?.amount ?? 0);
  const closingBalance = openingBalance + totalCredit - totalDebit;

  const rows: ReceiptRow[] = entries.map((entry) => {
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
      quotationId: entry.quotationId,
      quotationReference: entry.quotation?.reference ?? null,
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
    pendingAmount: Number(pendingReceipts._sum?.amount ?? 0),
    count: rows.length,
  };
}

export async function createReceipt(
  subject: ScopeSubject,
  input: ReceiptInput,
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
    const serial = await nextSequenceValue(branchId, "RECEIPT", year, tx);
    return tx.cashLedgerEntry.create({
      data: {
        reference: formatReference(branch.code, "RECEIPT", year, serial),
        entryDate: new Date(input.entryDate),
        branchId,
        customerId: input.customerId || null,
        quotationId: input.quotationId || null,
        partyType: input.partyType,
        partyName: input.partyName,
        direction: LedgerDirection.CREDIT,
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
    summary: `Recorded receipt of ${input.amount} from ${input.partyName} (${entry.reference})`,
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

export async function deleteReceipt(
  subject: ScopeSubject,
  id: string,
): Promise<void> {
  if (!hasPermission(subject, PERMISSIONS.LEDGER_DELETE)) {
    throw new ForbiddenError("You do not have permission to delete receipts.");
  }

  const existing = await prisma.cashLedgerEntry.findFirst({
    where: { id, direction: LedgerDirection.CREDIT, ...NOT_DELETED },
  });
  if (!existing) throw new RecordNotFoundError("Receipt");

  if (existing.status === LedgerStatus.CLEARED) {
    throw new BusinessRuleError(
      "A cleared receipt cannot be deleted. Post a reversing entry instead.",
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
    summary: `Deleted receipt ${existing.reference}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { amount: Number(existing.amount), status: existing.status, partyName: existing.partyName },
  });
}

// Outstanding Quotations (Invoices) for Customer Receipts
export async function getCustomerOutstandingInvoices(
  subject: ScopeSubject,
  customerId: string,
): Promise<any[]> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, ...NOT_DELETED },
  });
  if (!customer) throw new RecordNotFoundError("Customer");

  // Get approved/completed quotations
  const invoices = await prisma.quotation.findMany({
    where: {
      customerId,
      status: { in: [...INVOICE_STATUSES] },
      deletedAt: null,
    },
    include: {
      ledgerEntries: {
        where: {
          AND: [
            NOT_DELETED,
            { direction: LedgerDirection.CREDIT },
            { status: { in: [...SETTLED] } },
          ],
        },
        select: { amount: true },
      },
    },
    orderBy: { quotationDate: "desc" },
  });

  return invoices
    .map((inv) => {
      const grandTotal = Number(inv.grandTotal);
      const paid = inv.ledgerEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
      const due = Math.max(0, grandTotal - paid);

      return {
        id: inv.id,
        reference: inv.reference,
        amount: grandTotal,
        paidAmount: paid,
        dueAmount: due,
        date: inv.quotationDate,
      };
    })
    .filter((inv) => inv.dueAmount > 0);
}

// Customer Ledger Details
export async function getCustomerLedger(
  subject: ScopeSubject,
  customerId: string,
  filters: { readonly from?: string; readonly to?: string; readonly branchId?: string } = {},
): Promise<any> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, ...NOT_DELETED },
    include: { branch: { select: { name: true } } },
  });
  if (!customer) throw new RecordNotFoundError("Customer");

  const branchCond = filters.branchId ? { branchId: filters.branchId } : {};

  const baseOpeningBalance = Number(customer.garudaBalance || customer.currentDues || 0);

  // Compute opening balance (debit - credit) prior to filters.from
  let priorDebit = 0;
  let priorCredit = 0;

  if (filters.from) {
    const priorInvoices = await prisma.quotation.aggregate({
      _sum: { grandTotal: true },
      where: {
        AND: [
          { customerId },
          branchCond,
          { status: { in: [...INVOICE_STATUSES] } },
          { deletedAt: null },
          { quotationDate: { lt: filters.from } },
        ],
      },
    });
    priorDebit += Number(priorInvoices._sum?.grandTotal ?? 0);

    const priorLedger = await prisma.cashLedgerEntry.findMany({
      where: {
        AND: [
          { customerId },
          branchCond,
          { status: { in: [...SETTLED] } },
          { deletedAt: null },
          { particular: { not: { contains: "Opening" } } },
          { entryDate: { lt: new Date(filters.from) } },
        ],
      },
      select: { amount: true, direction: true },
    });

    priorLedger.forEach((entry) => {
      if (entry.direction === LedgerDirection.CREDIT) {
        priorCredit += Number(entry.amount);
      } else {
        priorDebit += Number(entry.amount);
      }
    });
  }

  const openingBalance = baseOpeningBalance + priorDebit - priorCredit;

  // Fetch quotations (invoices) inside the period
  const invoices = await prisma.quotation.findMany({
    where: {
      AND: [
        { customerId },
        branchCond,
        { status: { in: [...INVOICE_STATUSES] } },
        { deletedAt: null },
        filters.from ? { quotationDate: { gte: filters.from } } : {},
        filters.to ? { quotationDate: { lte: filters.to } } : {},
      ],
    },
  });

  // Fetch ledger entries (credits and debits) inside the period
  const ledgerEntries = await prisma.cashLedgerEntry.findMany({
    where: {
      AND: [
        { customerId },
        branchCond,
        { status: { in: [...SETTLED] } },
        { deletedAt: null },
        { particular: { not: { contains: "Opening" } } },
        filters.from ? { entryDate: { gte: new Date(filters.from) } } : {},
        filters.to ? { entryDate: { lte: new Date(filters.to) } } : {},
      ],
    },
  });

  const ledgerItems: any[] = [];

  invoices.forEach((inv) => {
    ledgerItems.push({
      id: inv.id,
      date: inv.quotationDate,
      voucherNo: inv.reference,
      description: `Sales Invoice (Quotation)`,
      debit: Number(inv.grandTotal), // Customer owes us more
      credit: 0,
      type: "INVOICE",
    });
  });

  ledgerEntries.forEach((entry) => {
    if (entry.direction === LedgerDirection.CREDIT) {
      ledgerItems.push({
        id: entry.id,
        date: entry.entryDate.toISOString().slice(0, 10),
        voucherNo: entry.reference,
        description: entry.particular,
        debit: 0,
        credit: Number(entry.amount), // Customer paid us
        type: "RECEIPT",
      });
    } else {
      ledgerItems.push({
        id: entry.id,
        date: entry.entryDate.toISOString().slice(0, 10),
        voucherNo: entry.reference,
        description: entry.particular,
        debit: Number(entry.amount), // Customer refunded / payment out
        credit: 0,
        type: "PAYMENT",
      });
    }
  });

  ledgerItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Running balance: Debit increases, Credit decreases
  let balance = openingBalance;
  let periodDebit = 0;
  let periodCredit = 0;

  const rows = ledgerItems.map((item) => {
    balance += item.debit - item.credit;
    periodDebit += item.debit;
    periodCredit += item.credit;
    return {
      ...item,
      balance,
    };
  });

  return {
    customerName: customer.name,
    openingBalance,
    closingBalance: balance,
    totalDebit: periodDebit,
    totalCredit: periodCredit,
    rows,
  };
}

export async function listAllOutstandingInvoices(subject: ScopeSubject): Promise<any[]> {
  const branchCond = branchWhere(subject);

  // Get approved/completed quotations
  const invoices = await prisma.quotation.findMany({
    where: {
      AND: [
        branchCond,
        { status: { in: [...INVOICE_STATUSES] } },
        { deletedAt: null },
      ],
    },
    include: {
      ledgerEntries: {
        where: {
          AND: [
            NOT_DELETED,
            { direction: LedgerDirection.CREDIT },
            { status: { in: [...SETTLED] } },
          ],
        },
        select: { amount: true },
      },
    },
    orderBy: { quotationDate: "desc" },
  });

  return invoices
    .map((inv) => {
      const grandTotal = Number(inv.grandTotal);
      const paid = inv.ledgerEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
      const due = Math.max(0, grandTotal - paid);

      return {
        id: inv.id,
        reference: inv.reference,
        amount: grandTotal,
        paidAmount: paid,
        dueAmount: due,
        customerId: inv.customerId,
      };
    })
    .filter((inv) => inv.dueAmount > 0);
}

export async function getDistinctOtherReceipts(subject: ScopeSubject): Promise<string[]> {
  const branchWhereCond = branchWhere(subject);

  const distinctFromEntries = await prisma.cashLedgerEntry.findMany({
    where: {
      AND: [
        branchWhereCond,
        NOT_DELETED,
        { direction: LedgerDirection.CREDIT },
        { partyType: { not: "CUSTOMER" } },
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

// Vendor Ledger Details
export async function getVendorLedger(
  subject: ScopeSubject,
  vendorId: string,
  filters: { readonly from?: string; readonly to?: string; readonly branchId?: string } = {},
): Promise<any> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, ...NOT_DELETED },
    include: { branch: { select: { name: true } } },
  });
  if (!vendor) throw new RecordNotFoundError("Vendor");

  const branchCond = filters.branchId ? { branchId: filters.branchId } : {};

  const baseOpeningBalance = Number(vendor.balance || 0);

  // Compute opening balance prior to filters.from
  let priorDebit = 0; // paid to vendor
  let priorCredit = 0; // billed by vendor

  if (filters.from) {
    const priorBills = await prisma.vendorBill.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          { vendorName: vendor.name },
          branchCond,
          { deletedAt: null },
          { billDate: { lt: new Date(filters.from) } },
        ],
      },
    });
    priorCredit += Number(priorBills._sum?.amount ?? 0);

    const priorLedger = await prisma.cashLedgerEntry.findMany({
      where: {
        AND: [
          { vendorId },
          branchCond,
          { status: { in: [...SETTLED] } },
          { deletedAt: null },
          { particular: { not: { contains: "Opening" } } },
          { entryDate: { lt: new Date(filters.from) } },
        ],
      },
      select: { amount: true, direction: true },
    });

    priorLedger.forEach((entry) => {
      if (entry.direction === LedgerDirection.DEBIT) {
        priorDebit += Number(entry.amount);
      } else {
        priorCredit += Number(entry.amount);
      }
    });
  }

  const openingBalance = baseOpeningBalance + priorCredit - priorDebit;

  // Fetch bills inside the period
  const bills = await prisma.vendorBill.findMany({
    where: {
      AND: [
        { vendorName: vendor.name },
        branchCond,
        { deletedAt: null },
        filters.from ? { billDate: { gte: new Date(filters.from) } } : {},
        filters.to ? { billDate: { lte: new Date(filters.to) } } : {},
      ],
    },
  });

  // Fetch ledger entries inside the period
  const ledgerEntries = await prisma.cashLedgerEntry.findMany({
    where: {
      AND: [
        { vendorId },
        branchCond,
        { status: { in: [...SETTLED] } },
        { deletedAt: null },
        { particular: { not: { contains: "Opening" } } },
        filters.from ? { entryDate: { gte: new Date(filters.from) } } : {},
        filters.to ? { entryDate: { lte: new Date(filters.to) } } : {},
      ],
    },
  });

  const ledgerItems: any[] = [];

  bills.forEach((bill) => {
    ledgerItems.push({
      id: bill.id,
      date: bill.billDate.toISOString().slice(0, 10),
      voucherNo: bill.billNumber,
      description: `Purchase Bill`,
      debit: 0,
      credit: Number(bill.amount),
      type: "BILL",
    });
  });

  ledgerEntries.forEach((entry) => {
    if (entry.direction === LedgerDirection.DEBIT) {
      ledgerItems.push({
        id: entry.id,
        date: entry.entryDate.toISOString().slice(0, 10),
        voucherNo: entry.reference,
        description: entry.particular,
        debit: Number(entry.amount),
        credit: 0,
        type: "PAYMENT",
      });
    } else {
      ledgerItems.push({
        id: entry.id,
        date: entry.entryDate.toISOString().slice(0, 10),
        voucherNo: entry.reference,
        description: entry.particular,
        debit: 0,
        credit: Number(entry.amount),
        type: "RECEIPT",
      });
    }
  });

  ledgerItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let balance = openingBalance;
  let periodDebit = 0;
  let periodCredit = 0;

  const rows = ledgerItems.map((item) => {
    balance += item.credit - item.debit;
    periodDebit += item.debit;
    periodCredit += item.credit;
    return {
      ...item,
      balance,
    };
  });

  return {
    vendorName: vendor.name,
    openingBalance,
    closingBalance: balance,
    totalDebit: periodDebit,
    totalCredit: periodCredit,
    rows,
  };
}

// Consolidated All-Account Ledger Details
export async function getConsolidatedLedger(
  subject: ScopeSubject,
  filters: { readonly from?: string; readonly to?: string; readonly branchId?: string } = {},
): Promise<any> {
  const branchCond = branchWhere(subject);
  const filterBranch = filters.branchId ? { branchId: filters.branchId } : {};
  const isSuper = subject.role === Role.SUPER_ADMIN;

  // Get branches for starting balances
  const branches = await prisma.branch.findMany({
    where: {
      ...NOT_DELETED,
      ...(isSuper
        ? (filters.branchId ? { id: filters.branchId } : {})
        : { id: subject.branchId ?? "__none__" }),
    },
    select: { id: true, startingBalance: true },
  });

  const totalStartingBalance = branches.reduce((sum, b) => sum + Number(b.startingBalance || 0), 0);

  let priorDebit = 0;
  let priorCredit = 0;

  if (filters.from) {
    const priorInvoices = await prisma.quotation.aggregate({
      _sum: { grandTotal: true },
      where: {
        AND: [
          branchCond,
          filterBranch,
          { status: { in: [...INVOICE_STATUSES] } },
          { deletedAt: null },
          { quotationDate: { lt: filters.from } },
        ],
      },
    });
    priorDebit += Number(priorInvoices._sum?.grandTotal ?? 0);

    const priorBills = await prisma.vendorBill.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          branchCond,
          filterBranch,
          { deletedAt: null },
          { billDate: { lt: new Date(filters.from) } },
        ],
      },
    });
    priorCredit += Number(priorBills._sum?.amount ?? 0);

    const priorLedger = await prisma.cashLedgerEntry.findMany({
      where: {
        AND: [
          branchCond,
          filterBranch,
          { status: { in: [...SETTLED] } },
          { deletedAt: null },
          { entryDate: { lt: new Date(filters.from) } },
        ],
      },
      select: { amount: true, direction: true },
    });

    priorLedger.forEach((entry) => {
      if (entry.direction === LedgerDirection.CREDIT) {
        priorCredit += Number(entry.amount);
      } else {
        priorDebit += Number(entry.amount);
      }
    });
  }

  const openingBalance = totalStartingBalance + priorDebit - priorCredit;

  // Fetch invoices in period
  const invoices = await prisma.quotation.findMany({
    where: {
      AND: [
        branchCond,
        filterBranch,
        { status: { in: [...INVOICE_STATUSES] } },
        { deletedAt: null },
        filters.from ? { quotationDate: { gte: filters.from } } : {},
        filters.to ? { quotationDate: { lte: filters.to } } : {},
      ],
    },
  });

  // Fetch bills in period
  const bills = await prisma.vendorBill.findMany({
    where: {
      AND: [
        branchCond,
        filterBranch,
        { deletedAt: null },
        filters.from ? { billDate: { gte: new Date(filters.from) } } : {},
        filters.to ? { billDate: { lte: new Date(filters.to) } } : {},
      ],
    },
  });

  // Fetch ledger entries in period
  const ledgerEntries = await prisma.cashLedgerEntry.findMany({
    where: {
      AND: [
        branchCond,
        filterBranch,
        { status: { in: [...SETTLED] } },
        { deletedAt: null },
        filters.from ? { entryDate: { gte: new Date(filters.from) } } : {},
        filters.to ? { entryDate: { lte: new Date(filters.to) } } : {},
      ],
    },
    include: {
      customer: { select: { name: true } },
      vendor: { select: { name: true } },
    },
  });

  const ledgerItems: any[] = [];

  invoices.forEach((inv) => {
    ledgerItems.push({
      id: inv.id,
      date: inv.quotationDate,
      voucherNo: inv.reference,
      partyName: inv.partyName,
      description: `Sales Invoice (${inv.brand})`,
      debit: Number(inv.grandTotal),
      credit: 0,
      type: "INVOICE",
    });
  });

  bills.forEach((bill) => {
    ledgerItems.push({
      id: bill.id,
      date: bill.billDate.toISOString().slice(0, 10),
      voucherNo: bill.billNumber,
      partyName: bill.vendorName,
      description: `Purchase Bill`,
      debit: 0,
      credit: Number(bill.amount),
      type: "BILL",
    });
  });

  ledgerEntries.forEach((entry) => {
    const partyName = entry.partyName ?? entry.customer?.name ?? entry.vendor?.name ?? entry.particular;
    if (entry.direction === LedgerDirection.CREDIT) {
      ledgerItems.push({
        id: entry.id,
        date: entry.entryDate.toISOString().slice(0, 10),
        voucherNo: entry.reference,
        partyName,
        description: entry.particular,
        debit: 0,
        credit: Number(entry.amount),
        type: "RECEIPT",
      });
    } else {
      ledgerItems.push({
        id: entry.id,
        date: entry.entryDate.toISOString().slice(0, 10),
        voucherNo: entry.reference,
        partyName,
        description: entry.particular,
        debit: Number(entry.amount),
        credit: 0,
        type: "PAYMENT",
      });
    }
  });

  ledgerItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let balance = openingBalance;
  let periodDebit = 0;
  let periodCredit = 0;

  const rows = ledgerItems.map((item) => {
    balance += item.debit - item.credit;
    periodDebit += item.debit;
    periodCredit += item.credit;
    return {
      ...item,
      balance,
    };
  });

  return {
    accountName: "All Accounts (Consolidated Ledger)",
    openingBalance,
    closingBalance: balance,
    totalDebit: periodDebit,
    totalCredit: periodCredit,
    rows,
  };
}

