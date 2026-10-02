import "server-only";
import { LedgerDirection, LedgerStatus, Prisma } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import { branchWhere, type ScopeSubject } from "@/modules/permissions/scope";
import { RecordNotFoundError } from "@/modules/shared/action-result";

const SETTLED: readonly LedgerStatus[] = [
  LedgerStatus.RECEIVED,
  LedgerStatus.CLEARED,
];

export interface VendorAgeingSummary {
  readonly current: number;    // 0 to 30 days
  readonly days31To60: number; // 31 to 60 days
  readonly days61To90: number; // 61 to 90 days
  readonly days91Plus: number; // 91+ days
}

export interface VendorBillDetail {
  readonly id: string;
  readonly billNumber: string;
  readonly vendorName: string;
  readonly amount: number;
  readonly paidAmount: number;
  readonly outstandingAmount: number;
  readonly billDate: string; // YYYY-MM-DD
  readonly dueDate: string;  // YYYY-MM-DD
  readonly daysOverdue: number;
  readonly isOverdue: boolean;
  readonly status: "Pending" | "Partially Paid" | "Paid" | "Overdue";
  readonly linkedPayments: readonly {
    readonly id: string;
    readonly reference: string;
    readonly amount: number;
    readonly entryDate: string;
    readonly paymentMethod: string;
    readonly referenceNo: string | null;
  }[];
}

export interface VendorPaymentHistoryItem {
  readonly id: string;
  readonly reference: string;
  readonly entryDate: string;
  readonly amount: number;
  readonly direction: LedgerDirection;
  readonly paymentMethod: string;
  readonly referenceNo: string | null;
  readonly particular: string;
  readonly note: string | null;
  readonly status: LedgerStatus;
  readonly vendorBillId: string | null;
  readonly vendorBillNumber: string | null;
}

export interface VendorOutstandingSummary {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly gstNumber: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly branchId: string;
  readonly branchName: string;
  readonly openingBalance: number;
  readonly totalPayable: number;
  readonly totalPaid: number;
  readonly outstandingAmount: number;
  readonly overdueAmount: number;
  readonly maxDaysOverdue: number;
  readonly paymentStatus: "Pending" | "Partially Paid" | "Paid" | "Advance / Credit" | "Overdue";
  readonly lastPaymentDate: string | null;
  readonly lastPaymentRef: string | null;
  readonly lastTransactionDate: string | null;
  readonly ageing: VendorAgeingSummary;
  readonly bills: readonly VendorBillDetail[];
  readonly paymentHistory: readonly VendorPaymentHistoryItem[];
}

export interface VendorOutstandingFilterInput {
  readonly search?: string;
  readonly vendorId?: string;
  readonly branchId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly paymentStatus?: "ALL" | "Pending" | "Partially Paid" | "Paid" | "Advance / Credit" | "Overdue";
  readonly sortBy?: "highest_outstanding" | "oldest_outstanding" | "name" | "payable" | "overdue";
  readonly page?: number;
  readonly pageSize?: number;
}

export interface VendorOutstandingPage {
  readonly items: readonly VendorOutstandingSummary[];
  readonly totalVendors: number;
  readonly totalPayableSum: number;
  readonly totalPaidSum: number;
  readonly totalOutstandingSum: number;
  readonly totalOverdueSum: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
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
              { email: { contains: filters.search.trim(), mode: "insensitive" } },
              { gstNumber: { contains: filters.search.trim(), mode: "insensitive" } },
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
            { status: { in: [...SETTLED] } },
            { particular: { not: { contains: "Opening" } } },
            filters.to ? { entryDate: { lte: new Date(filters.to) } } : {},
          ],
        },
        include: {
          vendorBill: { select: { billNumber: true } },
        },
        orderBy: { entryDate: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const vendorNames = vendors.map((v) => v.name);
  const vendorBills = await prisma.vendorBill.findMany({
    where: {
      AND: [
        NOT_DELETED,
        branchCond,
        { vendorName: { in: vendorNames } },
        filters.to ? { billDate: { lte: new Date(filters.to) } } : {},
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
        select: {
          id: true,
          reference: true,
          amount: true,
          entryDate: true,
          paymentMethod: true,
          referenceNo: true,
        },
        orderBy: { entryDate: "desc" },
      },
    },
    orderBy: { billDate: "desc" },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allItems: VendorOutstandingSummary[] = vendors.map((v) => {
    const openingBalance = Number(v.balance || 0);

    const vBills = vendorBills.filter(
      (b) => b.branchId === v.branchId && b.vendorName.toLowerCase() === v.name.toLowerCase(),
    );

    const debits = v.ledgerEntries
      .filter((e) => e.direction === LedgerDirection.DEBIT)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const credits = v.ledgerEntries
      .filter((e) => e.direction === LedgerDirection.CREDIT)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const totalBillAmount = vBills.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalPayable = openingBalance + totalBillAmount + credits;
    const totalPaid = debits;
    const outstandingAmount = totalPayable - totalPaid;

    // Allocate unlinked debit payments sequentially (FIFO) to bills without direct ledger linking
    let unallocatedPayments = v.ledgerEntries
      .filter((e) => e.direction === LedgerDirection.DEBIT && !e.vendorBillId)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const billsAsc = [...vBills].sort(
      (a, b) => new Date(a.billDate).getTime() - new Date(b.billDate).getTime(),
    );

    const billDetailsMap = new Map<string, VendorBillDetail>();
    let totalVendorOverdue = 0;
    let maxVendorDaysOverdue = 0;

    const ageing = {
      current: 0,
      days31To60: 0,
      days61To90: 0,
      days91Plus: 0,
    };

    for (const b of billsAsc) {
      const bAmount = Number(b.amount);
      const directPaid = b.ledgerEntries.reduce((sum, e) => sum + Number(e.amount), 0);

      let allocatedFromUnlinked = 0;
      const remainingUncovered = Math.max(0, bAmount - directPaid);
      if (remainingUncovered > 0 && unallocatedPayments > 0) {
        allocatedFromUnlinked = Math.min(remainingUncovered, unallocatedPayments);
        unallocatedPayments -= allocatedFromUnlinked;
      }

      const billTotalPaid = directPaid + allocatedFromUnlinked;
      const billOutstanding = Math.max(0, bAmount - billTotalPaid);

      // Default due date: billDate + 30 days
      const bDate = new Date(b.billDate);
      const dDate = new Date(bDate);
      dDate.setDate(dDate.getDate() + 30);

      const daysOld = Math.max(0, Math.floor((today.getTime() - bDate.getTime()) / 86400000));
      const daysOverdue = billOutstanding > 0 && today > dDate
        ? Math.floor((today.getTime() - dDate.getTime()) / 86400000)
        : 0;

      const isOverdue = daysOverdue > 0;

      if (isOverdue) {
        totalVendorOverdue += billOutstanding;
        if (daysOverdue > maxVendorDaysOverdue) {
          maxVendorDaysOverdue = daysOverdue;
        }
      }

      // Ageing breakdown of remaining balance
      if (billOutstanding > 0) {
        if (daysOld <= 30) ageing.current += billOutstanding;
        else if (daysOld <= 60) ageing.days31To60 += billOutstanding;
        else if (daysOld <= 90) ageing.days61To90 += billOutstanding;
        else ageing.days91Plus += billOutstanding;
      }

      let billStatus: "Pending" | "Partially Paid" | "Paid" | "Overdue" = "Pending";
      if (billOutstanding <= 0) {
        billStatus = "Paid";
      } else if (isOverdue) {
        billStatus = "Overdue";
      } else if (billTotalPaid > 0) {
        billStatus = "Partially Paid";
      }

      billDetailsMap.set(b.id, {
        id: b.id,
        billNumber: b.billNumber,
        vendorName: b.vendorName,
        amount: bAmount,
        paidAmount: billTotalPaid,
        outstandingAmount: billOutstanding,
        billDate: b.billDate.toISOString().slice(0, 10),
        dueDate: dDate.toISOString().slice(0, 10),
        daysOverdue,
        isOverdue,
        status: billStatus,
        linkedPayments: b.ledgerEntries.map((e) => ({
          id: e.id,
          reference: e.reference,
          amount: Number(e.amount),
          entryDate: e.entryDate.toISOString().slice(0, 10),
          paymentMethod: e.paymentMethod,
          referenceNo: e.referenceNo,
        })),
      });
    }

    const billsDetail = Array.from(billDetailsMap.values()).sort(
      (a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime(),
    );

    let paymentStatus: "Pending" | "Partially Paid" | "Paid" | "Advance / Credit" | "Overdue" = "Pending";
    if (outstandingAmount < 0) {
      paymentStatus = "Advance / Credit";
    } else if (totalPaid >= totalPayable && totalPayable > 0) {
      paymentStatus = "Paid";
    } else if (totalVendorOverdue > 0) {
      paymentStatus = "Overdue";
    } else if (totalPaid > 0) {
      paymentStatus = "Partially Paid";
    }

    let lastPaymentDate: string | null = null;
    let lastPaymentRef: string | null = null;
    const paidEntries = v.ledgerEntries.filter((e) => e.direction === LedgerDirection.DEBIT);
    if (paidEntries.length > 0) {
      const latest = paidEntries[0];
      lastPaymentDate = latest.entryDate.toISOString().slice(0, 10);
      lastPaymentRef = latest.reference;
    }

    let lastTransactionDate: string | null = null;
    const allDates: number[] = [];
    if (lastPaymentDate) allDates.push(new Date(lastPaymentDate).getTime());
    vBills.forEach((b) => allDates.push(b.billDate.getTime()));
    if (allDates.length > 0) {
      lastTransactionDate = new Date(Math.max(...allDates)).toISOString().slice(0, 10);
    }

    const paymentHistory: VendorPaymentHistoryItem[] = v.ledgerEntries.map((e) => ({
      id: e.id,
      reference: e.reference,
      entryDate: e.entryDate.toISOString().slice(0, 10),
      amount: Number(e.amount),
      direction: e.direction,
      paymentMethod: e.paymentMethod,
      referenceNo: e.referenceNo,
      particular: e.particular,
      note: e.note,
      status: e.status,
      vendorBillId: e.vendorBillId,
      vendorBillNumber: e.vendorBill?.billNumber ?? null,
    }));

    return {
      id: v.id,
      name: v.name,
      phone: v.phone,
      email: v.email,
      gstNumber: v.gstNumber,
      city: v.city,
      state: v.state,
      branchId: v.branchId,
      branchName: v.branch.name,
      openingBalance,
      totalPayable,
      totalPaid,
      outstandingAmount,
      overdueAmount: totalVendorOverdue,
      maxDaysOverdue: maxVendorDaysOverdue,
      paymentStatus,
      lastPaymentDate,
      lastPaymentRef,
      lastTransactionDate,
      ageing,
      bills: billsDetail,
      paymentHistory,
    };
  });

  // Apply Payment Status Filter
  let filteredItems = allItems;
  if (filters.paymentStatus && filters.paymentStatus !== "ALL") {
    const status = filters.paymentStatus;
    filteredItems = allItems.filter((item) => {
      if (status === "Overdue") return item.paymentStatus === "Overdue" || item.overdueAmount > 0;
      return item.paymentStatus === status;
    });
  }

  // Apply Sorting
  if (filters.sortBy === "highest_outstanding") {
    filteredItems.sort((a, b) => b.outstandingAmount - a.outstandingAmount);
  } else if (filters.sortBy === "oldest_outstanding") {
    filteredItems.sort((a, b) => {
      const dateA = a.lastTransactionDate ? new Date(a.lastTransactionDate).getTime() : 0;
      const dateB = b.lastTransactionDate ? new Date(b.lastTransactionDate).getTime() : 0;
      return dateA - dateB;
    });
  } else if (filters.sortBy === "payable") {
    filteredItems.sort((a, b) => b.totalPayable - a.totalPayable);
  } else if (filters.sortBy === "overdue") {
    filteredItems.sort((a, b) => b.overdueAmount - a.overdueAmount);
  } else if (filters.sortBy === "name") {
    filteredItems.sort((a, b) => a.name.localeCompare(b.name));
  }

  const totalVendors = filteredItems.length;
  const totalPayableSum = filteredItems.reduce((sum, i) => sum + i.totalPayable, 0);
  const totalPaidSum = filteredItems.reduce((sum, i) => sum + i.totalPaid, 0);
  const totalOutstandingSum = filteredItems.reduce((sum, i) => sum + i.outstandingAmount, 0);
  const totalOverdueSum = filteredItems.reduce((sum, i) => sum + i.overdueAmount, 0);

  // Pagination
  let page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize;

  let paginatedItems = filteredItems;
  let totalPages = 1;

  if (pageSize && pageSize > 0) {
    totalPages = Math.max(1, Math.ceil(totalVendors / pageSize));
    if (page > totalPages) page = totalPages;
    const startIndex = (page - 1) * pageSize;
    paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize);
  }

  return {
    items: paginatedItems,
    totalVendors,
    totalPayableSum,
    totalPaidSum,
    totalOutstandingSum,
    totalOverdueSum,
    page,
    pageSize: pageSize ?? totalVendors,
    totalPages,
  };
}
