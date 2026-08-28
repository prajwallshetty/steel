import "server-only";
import { LedgerDirection, LedgerStatus, QuotationStatus, Prisma } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import { branchWhere, type ScopeSubject } from "@/modules/permissions/scope";
import { RecordNotFoundError } from "@/modules/shared/action-result";

const SETTLED: readonly LedgerStatus[] = [
  LedgerStatus.RECEIVED,
  LedgerStatus.CLEARED,
];

const INVOICE_STATUSES: readonly QuotationStatus[] = [
  QuotationStatus.APPROVED,
  QuotationStatus.COMPLETED,
];

export interface CustomerOutstandingSummary {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly branchId: string;
  readonly branchName: string;
  readonly totalBilled: number;
  readonly totalPaid: number;
  readonly outstandingAmount: number;
  readonly paymentStatus: "Pending" | "Partially Paid" | "Paid" | "Advance / Credit";
  readonly lastPaymentDate: string | null;
  readonly lastTransactionDate: string | null;
}

export interface CustomerOutstandingFilterInput {
  readonly search?: string;
  readonly customerId?: string;
  readonly branchId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly sortBy?: "highest_outstanding" | "oldest_outstanding" | "name" | "billed";
}

export interface CustomerOutstandingPage {
  readonly items: readonly CustomerOutstandingSummary[];
  readonly totalCustomers: number;
  readonly totalBilledSum: number;
  readonly totalPaidSum: number;
  readonly totalOutstandingSum: number;
}

export async function listCustomerOutstanding(
  subject: ScopeSubject,
  filters: CustomerOutstandingFilterInput = {},
): Promise<CustomerOutstandingPage> {
  const branchCond = branchWhere(subject);

  const customerWhere: Prisma.CustomerWhereInput = {
    AND: [
      branchCond,
      NOT_DELETED,
      filters.branchId ? { branchId: filters.branchId } : {},
      filters.customerId ? { id: filters.customerId } : {},
      filters.search?.trim()
        ? {
            OR: [
              { name: { contains: filters.search.trim(), mode: "insensitive" } },
              { city: { contains: filters.search.trim(), mode: "insensitive" } },
              { phone: { contains: filters.search.trim(), mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const customers = await prisma.customer.findMany({
    where: customerWhere,
    include: {
      branch: { select: { name: true } },
      quotations: {
        where: {
          AND: [
            NOT_DELETED,
            { status: { in: [...INVOICE_STATUSES] } },
            filters.to ? { quotationDate: { lte: filters.to } } : {},
          ],
        },
        select: { id: true, grandTotal: true, quotationDate: true },
      },
      ledgerEntries: {
        where: {
          AND: [
            NOT_DELETED,
            { status: { in: [...SETTLED] } },
            { particular: { not: { contains: "Opening" } } },
            filters.to ? { entryDate: { lte: new Date(filters.to) } } : {},
          ],
        },
        select: { id: true, amount: true, direction: true, entryDate: true },
      },
    },
    orderBy: { name: "asc" },
  });

  let totalBilledSum = 0;
  let totalPaidSum = 0;
  let totalOutstandingSum = 0;

  const items: CustomerOutstandingSummary[] = customers.map((c) => {
    const openingBalance = Number(c.garudaBalance || c.currentDues || 0);
    const quotationTotal = c.quotations.reduce((sum, q) => sum + Number(q.grandTotal), 0);

    const debits = c.ledgerEntries
      .filter((e) => e.direction === LedgerDirection.DEBIT)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const credits = c.ledgerEntries
      .filter((e) => e.direction === LedgerDirection.CREDIT)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const totalBilled = openingBalance + quotationTotal + debits;
    const totalPaid = credits;
    const outstandingAmount = totalBilled - totalPaid;

    let paymentStatus: "Pending" | "Partially Paid" | "Paid" | "Advance / Credit" = "Pending";
    if (outstandingAmount < 0) {
      paymentStatus = "Advance / Credit";
    } else if (totalPaid >= totalBilled && totalBilled > 0) {
      paymentStatus = "Paid";
    } else if (totalPaid > 0) {
      paymentStatus = "Partially Paid";
    }

    // Last payment date
    let lastPaymentDate: string | null = null;
    if (c.ledgerEntries.length > 0) {
      const dates = c.ledgerEntries.map((e) => e.entryDate.getTime());
      lastPaymentDate = new Date(Math.max(...dates)).toISOString().slice(0, 10);
    }

    // Last transaction date
    let lastTransactionDate: string | null = null;
    const allDates: number[] = [];
    if (lastPaymentDate) allDates.push(new Date(lastPaymentDate).getTime());
    c.quotations.forEach((q) => {
      allDates.push(new Date(q.quotationDate).getTime());
    });
    if (allDates.length > 0) {
      lastTransactionDate = new Date(Math.max(...allDates)).toISOString().slice(0, 10);
    }

    totalBilledSum += totalBilled;
    totalPaidSum += totalPaid;
    totalOutstandingSum += outstandingAmount;

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      city: c.city,
      state: c.state,
      branchId: c.branchId,
      branchName: c.branch.name,
      totalBilled,
      totalPaid,
      outstandingAmount,
      paymentStatus,
      lastPaymentDate,
      lastTransactionDate,
    };
  });

  // Apply sorting
  if (filters.sortBy === "highest_outstanding") {
    items.sort((a, b) => b.outstandingAmount - a.outstandingAmount);
  } else if (filters.sortBy === "oldest_outstanding") {
    items.sort((a, b) => {
      const dateA = a.lastTransactionDate ? new Date(a.lastTransactionDate).getTime() : 0;
      const dateB = b.lastTransactionDate ? new Date(b.lastTransactionDate).getTime() : 0;
      return dateA - dateB;
    });
  } else if (filters.sortBy === "billed") {
    items.sort((a, b) => b.totalBilled - a.totalBilled);
  }

  return {
    items,
    totalCustomers: items.length,
    totalBilledSum,
    totalPaidSum,
    totalOutstandingSum,
  };
}
