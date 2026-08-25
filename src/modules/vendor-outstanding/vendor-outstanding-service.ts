import "server-only";
import { LedgerDirection, LedgerStatus, Prisma } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import { branchWhere, type ScopeSubject } from "@/modules/permissions/scope";
import { RecordNotFoundError } from "@/modules/shared/action-result";

const SETTLED: readonly LedgerStatus[] = [
  LedgerStatus.RECEIVED,
  LedgerStatus.CLEARED,
];

export interface VendorOutstandingSummary {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly branchId: string;
  readonly branchName: string;
  readonly totalPayable: number;
  readonly totalPaid: number;
  readonly outstandingAmount: number;
  readonly paymentStatus: "Pending" | "Partially Paid" | "Paid";
  readonly lastPaymentDate: string | null;
  readonly lastTransactionDate: string | null;
}

export interface VendorOutstandingFilterInput {
  readonly search?: string;
  readonly vendorId?: string;
  readonly branchId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly sortBy?: "highest_outstanding" | "oldest_outstanding" | "name" | "payable";
}

export interface VendorOutstandingPage {
  readonly items: readonly VendorOutstandingSummary[];
  readonly totalVendors: number;
  readonly totalPayableSum: number;
  readonly totalPaidSum: number;
  readonly totalOutstandingSum: number;
}

export async function listVendorOutstanding(
  subject: ScopeSubject,
  filters: VendorOutstandingFilterInput = {},
): Promise<VendorOutstandingPage> {
  const branchCond = branchWhere(subject);

  const vendorWhere: Prisma.VendorWhereInput = {
    AND: [
      branchCond,
      NOT_DELETED,
      filters.branchId ? { branchId: filters.branchId } : {},
      filters.vendorId ? { id: filters.vendorId } : {},
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

  const vendors = await prisma.vendor.findMany({
    where: vendorWhere,
    include: {
      branch: { select: { name: true } },
      ledgerEntries: {
        where: {
          AND: [
            NOT_DELETED,
            { direction: LedgerDirection.DEBIT },
            { status: { in: [...SETTLED] } },
            filters.from ? { entryDate: { gte: new Date(filters.from) } } : {},
            filters.to ? { entryDate: { lte: new Date(filters.to) } } : {},
          ],
        },
        select: { id: true, amount: true, entryDate: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Fetch VendorBills for these vendors by name / branch
  const vendorNames = vendors.map((v) => v.name);
  const vendorBills = await prisma.vendorBill.findMany({
    where: {
      AND: [
        NOT_DELETED,
        branchCond,
        { vendorName: { in: vendorNames } },
        filters.from ? { billDate: { gte: new Date(filters.from) } } : {},
        filters.to ? { billDate: { lte: new Date(filters.to) } } : {},
      ],
    },
    select: { vendorName: true, amount: true, billDate: true, branchId: true },
  });

  // Group bills by vendor name & branchId
  const billsMap = new Map<string, { totalAmount: number; dates: number[] }>();
  vendorBills.forEach((bill) => {
    const key = `${bill.branchId}__${bill.vendorName.toLowerCase()}`;
    const existing = billsMap.get(key) ?? { totalAmount: 0, dates: [] };
    existing.totalAmount += Number(bill.amount);
    existing.dates.push(bill.billDate.getTime());
    billsMap.set(key, existing);
  });

  let totalPayableSum = 0;
  let totalPaidSum = 0;
  let totalOutstandingSum = 0;

  const items: VendorOutstandingSummary[] = vendors.map((v) => {
    const openingBalance = Number(v.balance || 0);
    const key = `${v.branchId}__${v.name.toLowerCase()}`;
    const billData = billsMap.get(key) ?? { totalAmount: 0, dates: [] };
    const totalPayable = openingBalance + billData.totalAmount;

    const totalPaid = v.ledgerEntries.reduce((sum, e) => sum + Number(e.amount), 0);
    const outstandingAmount = Math.max(0, totalPayable - totalPaid);

    let paymentStatus: "Pending" | "Partially Paid" | "Paid" = "Pending";
    if (totalPaid >= totalPayable && totalPayable > 0) {
      paymentStatus = "Paid";
    } else if (totalPaid > 0) {
      paymentStatus = "Partially Paid";
    }

    // Last payment date
    let lastPaymentDate: string | null = null;
    if (v.ledgerEntries.length > 0) {
      const dates = v.ledgerEntries.map((e) => e.entryDate.getTime());
      lastPaymentDate = new Date(Math.max(...dates)).toISOString().slice(0, 10);
    }

    // Last transaction date
    let lastTransactionDate: string | null = null;
    const allDates: number[] = [];
    if (lastPaymentDate) allDates.push(new Date(lastPaymentDate).getTime());
    if (billData.dates.length > 0) {
      allDates.push(...billData.dates);
    }
    if (allDates.length > 0) {
      lastTransactionDate = new Date(Math.max(...allDates)).toISOString().slice(0, 10);
    }

    totalPayableSum += totalPayable;
    totalPaidSum += totalPaid;
    totalOutstandingSum += outstandingAmount;

    return {
      id: v.id,
      name: v.name,
      phone: v.phone,
      city: v.city,
      state: v.state,
      branchId: v.branchId,
      branchName: v.branch.name,
      totalPayable,
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
  } else if (filters.sortBy === "payable") {
    items.sort((a, b) => b.totalPayable - a.totalPayable);
  }

  return {
    items,
    totalVendors: items.length,
    totalPayableSum,
    totalPaidSum,
    totalOutstandingSum,
  };
}
