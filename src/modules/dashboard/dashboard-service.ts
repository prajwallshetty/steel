import "server-only";
import { cache } from "react";
import { LedgerDirection, LedgerStatus, QuotationStatus, Role, UserStatus } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import {
  ledgerScope,
  ledgerWhere,
  quotationScope,
  quotationWhere,
  type ScopeSubject,
} from "@/modules/permissions/scope";

const SETTLED: LedgerStatus[] = [LedgerStatus.RECEIVED, LedgerStatus.CLEARED];
const REVENUE_STATUSES: QuotationStatus[] = [
  QuotationStatus.APPROVED,
  QuotationStatus.COMPLETED,
];

export interface DashboardMetrics {
  readonly totalRevenue: number;
  readonly monthRevenue: number;
  readonly todayQuotations: number;
  readonly pendingQuotations: number;
  readonly totalQuotations: number;
  readonly totalCustomers: number;
  readonly collections: number;
  readonly pendingPayments: number;
  readonly activeUsers: number | null;
  readonly activeBranches: number | null;
  readonly monthlyRevenue: readonly { month: string; revenue: number }[];
  readonly branchPerformance: readonly {
    branchName: string;
    revenue: number;
    quotations: number;
  }[];
  readonly managerPerformance: readonly {
    name: string;
    revenue: number;
    quotations: number;
  }[];
  readonly paymentMix: readonly { method: string; amount: number }[];
  readonly recentQuotations: readonly {
    id: string;
    reference: string;
    partyName: string;
    grandTotal: number;
    status: QuotationStatus;
    quotationDate: string;
  }[];

  // New Metrics
  readonly paymentsToday: number;
  readonly receiptsToday: number;
  readonly cashBalance: number;
  readonly bankBalance: number;
  readonly outstandingReceivables: number;
  readonly outstandingPayables: number;
  readonly monthlyCashFlow: readonly { month: string; incoming: number; outgoing: number }[];
  readonly todayTransactions: readonly {
    id: string;
    reference: string;
    date: string;
    partyName: string;
    particular: string;
    amount: number;
    direction: string;
    status: LedgerStatus;
  }[];

  // Division Financial Overview
  readonly divisionFinancials: readonly DivisionFinancialMetric[];
  readonly overallFinancials: OverallFinancialMetric;
}

export interface DivisionFinancialMetric {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly startingBalance: number;
  readonly openingBalance: number;
  readonly totalRevenue: number;
  readonly totalExpenses: number;
  readonly closingBalance: number;
  readonly cashInHand: number;
}

export interface OverallFinancialMetric {
  readonly totalRevenue: number;
  readonly totalExpenses: number;
  readonly totalClosingBalance: number;
  readonly totalCashInHand: number;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export interface DashboardFilters {
  readonly from?: string;
  readonly to?: string;
}

export const getDashboardMetrics = cache(
  async (
    subject: ScopeSubject,
    filters?: DashboardFilters,
  ): Promise<DashboardMetrics> => {

  const qScope = quotationWhere(quotationScope(subject));
  const lScope = ledgerWhere(ledgerScope(subject));

  const now = new Date();
  const today = isoDay(now);

  const from = filters?.from;
  const to = filters?.to;
  const isFiltered = Boolean(from || to);

  // For period-based queries
  const startDay = from ?? today;
  const endDay = to ?? today;
  const startDate = new Date(startDay);
  const endDate = new Date(endDay);

  // For outstanding / balance queries, we go from beginning of time up to endDate
  const balanceEndDay = to ?? today;
  const balanceEndDate = new Date(balanceEndDay);

  // For charts (past 12 months if not filtered, otherwise the filtered range)
  const chartStart = isFiltered ? startDate : new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const chartEnd = isFiltered ? endDate : now;
  const chartStartDay = isFiltered ? startDay : isoDay(chartStart);
  const chartEndDay = isFiltered ? endDay : isoDay(chartEnd);

  const quotationBase = { AND: [qScope, NOT_DELETED] };
  const ledgerBase = { AND: [lScope, NOT_DELETED] };
  const isSuper = subject.role === Role.SUPER_ADMIN;

  const [
    revenueAll,
    revenueMonth,
    todayCount,
    pendingCount,
    totalCount,
    customerCount,
    collections,
    pendingPayments,
    userCount,
    branchCount,
    revenueRows,
    branchRows,
    managerRows,
    paymentRows,
    recent,

    // New queries
    paymentsTodayRes,
    receiptsTodayRes,
    cashCreditsRes,
    cashDebitsRes,
    bankCreditsRes,
    bankDebitsRes,
    totalInvoicedRes,
    totalReceivedOnInvoicesRes,
    totalBillsRes,
    totalPaidOnBillsRes,
    cashFlowEntries,
    todayTransactionsEntries,
  ] = await Promise.all([
    prisma.quotation.aggregate({
      _sum: { grandTotal: true },
      where: {
        AND: [
          quotationBase,
          { status: { in: REVENUE_STATUSES } },
          isFiltered ? { quotationDate: { gte: startDay, lte: endDay } } : {},
        ],
      },
    }),
    prisma.quotation.aggregate({
      _sum: { grandTotal: true },
      where: {
        AND: [
          quotationBase,
          { status: { in: REVENUE_STATUSES } },
          isFiltered
            ? { quotationDate: { gte: startDay, lte: endDay } }
            : { quotationDate: { gte: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)) } },
        ],
      },
    }),
    prisma.quotation.count({
      where: {
        AND: [
          quotationBase,
          isFiltered
            ? { quotationDate: { gte: startDay, lte: endDay } }
            : { quotationDate: today },
        ],
      },
    }),
    prisma.quotation.count({
      where: {
        AND: [quotationBase, { status: QuotationStatus.PENDING_APPROVAL }],
      },
    }),
    prisma.quotation.count({
      where: {
        AND: [
          quotationBase,
          isFiltered ? { quotationDate: { gte: startDay, lte: endDay } } : {},
        ],
      },
    }),
    prisma.customer.count({
      where: {
        ...NOT_DELETED,
        ...(isSuper ? {} : { branchId: subject.branchId ?? "__none__" }),
      },
    }),
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          ledgerBase,
          { status: { in: SETTLED } },
          { direction: "CREDIT" },
          isFiltered ? { entryDate: { gte: startDate, lte: endDate } } : {},
        ],
      },
    }),
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          ledgerBase,
          { status: LedgerStatus.PENDING },
          isFiltered ? { entryDate: { gte: startDate, lte: endDate } } : {},
        ],
      },
    }),
    isSuper || subject.role === Role.BRANCH_ADMIN
      ? prisma.user.count({
          where: {
            status: UserStatus.ACTIVE,
            ...NOT_DELETED,
            ...(isSuper ? {} : { branchId: subject.branchId ?? "__none__" }),
          },
        })
      : Promise.resolve(null),
    isSuper
      ? prisma.branch.count({ where: { status: "ACTIVE", ...NOT_DELETED } })
      : Promise.resolve(null),
    prisma.quotation.findMany({
      where: {
        AND: [
          quotationBase,
          { status: { in: REVENUE_STATUSES } },
          { quotationDate: { gte: chartStartDay, lte: chartEndDay } },
        ],
      },
      select: { quotationDate: true, grandTotal: true },
    }),
    isSuper
      ? prisma.quotation.groupBy({
          by: ["branchId"],
          where: {
            AND: [
              quotationBase,
              { status: { in: REVENUE_STATUSES } },
              isFiltered ? { quotationDate: { gte: startDay, lte: endDay } } : {},
            ],
          },
          _sum: { grandTotal: true },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    subject.role === Role.MANAGER
      ? Promise.resolve([])
      : prisma.quotation.groupBy({
          by: ["assignedToId"],
          where: {
            AND: [
              quotationBase,
              { status: { in: REVENUE_STATUSES } },
              isFiltered ? { quotationDate: { gte: startDay, lte: endDay } } : {},
            ],
          },
          _sum: { grandTotal: true },
          _count: { _all: true },
        }),
    prisma.cashLedgerEntry.groupBy({
      by: ["paymentMethod"],
      where: {
        AND: [
          ledgerBase,
          { status: { in: SETTLED } },
          isFiltered ? { entryDate: { gte: startDate, lte: endDate } } : {},
        ],
      },
      _sum: { amount: true },
    }),
    prisma.quotation.findMany({
      where: {
        AND: [
          quotationBase,
          isFiltered ? { quotationDate: { gte: startDay, lte: endDay } } : {},
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        reference: true,
        partyName: true,
        grandTotal: true,
        status: true,
        quotationDate: true,
      },
    }),

    // Payments in Period (DEBIT entries in period)
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          ledgerBase,
          { direction: LedgerDirection.DEBIT },
          { status: { in: SETTLED } },
          isFiltered
            ? { entryDate: { gte: startDate, lte: endDate } }
            : { entryDate: new Date(today) },
        ],
      },
    }),

    // Receipts in Period (CREDIT entries in period)
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          ledgerBase,
          { direction: LedgerDirection.CREDIT },
          { status: { in: SETTLED } },
          isFiltered
            ? { entryDate: { gte: startDate, lte: endDate } }
            : { entryDate: new Date(today) },
        ],
      },
    }),

    // Cash Credits
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          ledgerBase,
          { direction: LedgerDirection.CREDIT },
          { status: { in: SETTLED } },
          { paymentMethod: "CASH" },
          { entryDate: { lte: balanceEndDate } },
        ],
      },
    }),

    // Cash Debits
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          ledgerBase,
          { direction: LedgerDirection.DEBIT },
          { status: { in: SETTLED } },
          { paymentMethod: "CASH" },
          { entryDate: { lte: balanceEndDate } },
        ],
      },
    }),

    // Bank Credits
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          ledgerBase,
          { direction: LedgerDirection.CREDIT },
          { status: { in: SETTLED } },
          { paymentMethod: { not: "CASH" } },
          { entryDate: { lte: balanceEndDate } },
        ],
      },
    }),

    // Bank Debits
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          ledgerBase,
          { direction: LedgerDirection.DEBIT },
          { status: { in: SETTLED } },
          { paymentMethod: { not: "CASH" } },
          { entryDate: { lte: balanceEndDate } },
        ],
      },
    }),

    // Total Invoiced for outstanding receivables
    prisma.quotation.aggregate({
      _sum: { grandTotal: true },
      where: {
        AND: [
          quotationBase,
          { status: { in: REVENUE_STATUSES } },
          { quotationDate: { lte: balanceEndDay } },
        ],
      },
    }),

    // Total Received against invoices
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          ledgerBase,
          { status: { in: SETTLED } },
          { direction: LedgerDirection.CREDIT },
          { quotationId: { not: null } },
          { entryDate: { lte: balanceEndDate } },
        ],
      },
    }),

    // Total Vendor Bills for outstanding payables
    prisma.vendorBill.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          isSuper ? {} : { branchId: subject.branchId ?? "__none__" },
          NOT_DELETED,
          { billDate: { lte: balanceEndDate } },
        ],
      },
    }),

    // Total Paid against vendor bills
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          ledgerBase,
          { status: { in: SETTLED } },
          { direction: LedgerDirection.DEBIT },
          { vendorBillId: { not: null } },
          { entryDate: { lte: balanceEndDate } },
        ],
      },
    }),

    // Cash flow entries for the period
    prisma.cashLedgerEntry.findMany({
      where: {
        AND: [
          ledgerBase,
          { status: { in: SETTLED } },
          { entryDate: { gte: chartStart, lte: chartEnd } },
        ],
      },
      select: { entryDate: true, amount: true, direction: true },
    }),

    // Transactions in period
    prisma.cashLedgerEntry.findMany({
      where: {
        AND: [
          ledgerBase,
          isFiltered
            ? { entryDate: { gte: startDate, lte: endDate } }
            : { entryDate: new Date(today) },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        reference: true,
        entryDate: true,
        partyName: true,
        particular: true,
        amount: true,
        direction: true,
        status: true,
      },
    }),
  ]);

  // Bucket by month for revenue
  const monthly = new Map<string, number>();
  const flowMonthly = new Map<string, { incoming: number; outgoing: number }>();

  if (isFiltered) {
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endLimit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    let count = 0;
    while (current <= endLimit && count < 36) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const key = `${year}-${month}`;
      monthly.set(key, 0);
      flowMonthly.set(key, { incoming: 0, outgoing: 0 });
      current.setMonth(current.getMonth() + 1);
      count++;
    }
  } else {
    for (let index = 11; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      monthly.set(`${year}-${month}`, 0);
      flowMonthly.set(`${year}-${month}`, { incoming: 0, outgoing: 0 });
    }
  }

  for (const row of revenueRows) {
    const key = row.quotationDate.slice(0, 7);
    if (monthly.has(key)) {
      monthly.set(key, (monthly.get(key) ?? 0) + Number(row.grandTotal));
    }
  }

  for (const row of cashFlowEntries) {
    const year = row.entryDate.getUTCFullYear();
    const month = String(row.entryDate.getUTCMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    if (flowMonthly.has(key)) {
      const val = flowMonthly.get(key)!;
      if (row.direction === LedgerDirection.CREDIT) {
        val.incoming += Number(row.amount);
      } else {
        val.outgoing += Number(row.amount);
      }
    }
  }

  const [branchNames, managerNames] = await Promise.all([
    branchRows.length
      ? prisma.branch.findMany({
          where: { id: { in: branchRows.map((row) => row.branchId) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    managerRows.length
      ? prisma.user.findMany({
          where: {
            id: {
              in: managerRows
                .map((row) => row.assignedToId)
                .filter((id): id is string => Boolean(id)),
            },
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const branchNameById = new Map(branchNames.map((b) => [b.id, b.name]));
  const managerNameById = new Map(managerNames.map((u) => [u.id, u.name]));

  const cashBalance = Number(cashCreditsRes._sum?.amount ?? 0) - Number(cashDebitsRes._sum?.amount ?? 0);
  const bankBalance = Number(bankCreditsRes._sum?.amount ?? 0) - Number(bankDebitsRes._sum?.amount ?? 0);

  const outstandingReceivables = Math.max(
    0,
    Number(totalInvoicedRes._sum?.grandTotal ?? 0) - Number(totalReceivedOnInvoicesRes._sum?.amount ?? 0)
  );

  const outstandingPayables = Math.max(
    0,
    Number(totalBillsRes._sum?.amount ?? 0) - Number(totalPaidOnBillsRes._sum?.amount ?? 0)
  );

  // --- Division Financial Overview Calculations ---
  const activeDivisions = await prisma.branch.findMany({
    where: {
      ...NOT_DELETED,
      status: "ACTIVE",
      ...(isSuper ? {} : { id: subject.branchId ?? "__none__" }),
    },
    select: { id: true, name: true, code: true, startingBalance: true },
    orderBy: { name: "asc" },
  });

  const divisionIds = activeDivisions.map((d) => d.id);

  const priorAggregates = isFiltered && from
    ? await prisma.cashLedgerEntry.groupBy({
        by: ["branchId", "direction"],
        where: {
          branchId: { in: divisionIds },
          status: { in: SETTLED },
          entryDate: { lt: startDate },
          ...NOT_DELETED,
        },
        _sum: { amount: true },
      })
    : [];

  const periodAggregates = await prisma.cashLedgerEntry.groupBy({
    by: ["branchId", "direction"],
    where: {
      branchId: { in: divisionIds },
      status: { in: SETTLED },
      ...(isFiltered ? { entryDate: { gte: startDate, lte: endDate } } : {}),
      ...NOT_DELETED,
    },
    _sum: { amount: true },
  });

  const cashInHandAggregates = await prisma.cashLedgerEntry.groupBy({
    by: ["branchId", "direction"],
    where: {
      branchId: { in: divisionIds },
      status: { in: SETTLED },
      paymentMethod: "CASH",
      entryDate: { lte: balanceEndDate },
      ...NOT_DELETED,
    },
    _sum: { amount: true },
  });

  const priorMap = new Map<string, { credit: number; debit: number }>();
  for (const row of priorAggregates) {
    const existing = priorMap.get(row.branchId) ?? { credit: 0, debit: 0 };
    if (row.direction === LedgerDirection.CREDIT) {
      existing.credit += Number(row._sum.amount ?? 0);
    } else {
      existing.debit += Number(row._sum.amount ?? 0);
    }
    priorMap.set(row.branchId, existing);
  }

  const periodMap = new Map<string, { credit: number; debit: number }>();
  for (const row of periodAggregates) {
    const existing = periodMap.get(row.branchId) ?? { credit: 0, debit: 0 };
    if (row.direction === LedgerDirection.CREDIT) {
      existing.credit += Number(row._sum.amount ?? 0);
    } else {
      existing.debit += Number(row._sum.amount ?? 0);
    }
    periodMap.set(row.branchId, existing);
  }

  const cashInHandMap = new Map<string, { credit: number; debit: number }>();
  for (const row of cashInHandAggregates) {
    const existing = cashInHandMap.get(row.branchId) ?? { credit: 0, debit: 0 };
    if (row.direction === LedgerDirection.CREDIT) {
      existing.credit += Number(row._sum.amount ?? 0);
    } else {
      existing.debit += Number(row._sum.amount ?? 0);
    }
    cashInHandMap.set(row.branchId, existing);
  }

  const divisionFinancials: DivisionFinancialMetric[] = activeDivisions.map((div) => {
    const startingBalance = Number(div.startingBalance ?? 0);
    const prior = priorMap.get(div.id) ?? { credit: 0, debit: 0 };
    const period = periodMap.get(div.id) ?? { credit: 0, debit: 0 };
    const cash = cashInHandMap.get(div.id) ?? { credit: 0, debit: 0 };

    const openingBalance = startingBalance + prior.credit - prior.debit;
    const totalRevenue = period.credit;
    const totalExpenses = period.debit;
    const closingBalance = openingBalance + totalRevenue - totalExpenses;
    const cashInHand = startingBalance + cash.credit - cash.debit;

    return {
      id: div.id,
      code: div.code,
      name: div.name,
      startingBalance,
      openingBalance,
      totalRevenue,
      totalExpenses,
      closingBalance,
      cashInHand,
    };
  });

  const overallFinancials: OverallFinancialMetric = divisionFinancials.reduce(
    (acc, cur) => ({
      totalRevenue: acc.totalRevenue + cur.totalRevenue,
      totalExpenses: acc.totalExpenses + cur.totalExpenses,
      totalClosingBalance: acc.totalClosingBalance + cur.closingBalance,
      totalCashInHand: acc.totalCashInHand + cur.cashInHand,
    }),
    { totalRevenue: 0, totalExpenses: 0, totalClosingBalance: 0, totalCashInHand: 0 }
  );

  return {
    totalRevenue: Number(revenueAll._sum?.grandTotal ?? 0),
    monthRevenue: Number(revenueMonth._sum?.grandTotal ?? 0),
    todayQuotations: todayCount,
    pendingQuotations: pendingCount,
    totalQuotations: totalCount,
    totalCustomers: customerCount,
    collections: Number(collections._sum?.amount ?? 0),
    pendingPayments: Number(pendingPayments._sum?.amount ?? 0),
    activeUsers: userCount,
    activeBranches: branchCount,
    monthlyRevenue: [...monthly.entries()].map(([month, revenue]) => ({
      month,
      revenue,
    })),
    branchPerformance: branchRows
      .map((row) => ({
        branchName: branchNameById.get(row.branchId) ?? "Unknown",
        revenue: Number(row._sum?.grandTotal ?? 0),
        quotations: row._count._all,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    managerPerformance: managerRows
      .map((row) => ({
        name: row.assignedToId
          ? (managerNameById.get(row.assignedToId) ?? "Unknown")
          : "Unassigned",
        revenue: Number(row._sum?.grandTotal ?? 0),
        quotations: row._count._all,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
    paymentMix: paymentRows
      .map((row) => ({
        method: row.paymentMethod,
        amount: Number(row._sum?.amount ?? 0),
      }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount),
    recentQuotations: recent.map((row) => ({
      id: row.id,
      reference: row.reference,
      partyName: row.partyName,
      grandTotal: Number(row.grandTotal),
      status: row.status,
      quotationDate: row.quotationDate,
    })),

    // New metrics
    paymentsToday: Number(paymentsTodayRes._sum?.amount ?? 0),
    receiptsToday: Number(receiptsTodayRes._sum?.amount ?? 0),
    cashBalance,
    bankBalance,
    outstandingReceivables,
    outstandingPayables,
    monthlyCashFlow: [...flowMonthly.entries()].map(([month, flow]) => ({
      month,
      incoming: flow.incoming,
      outgoing: flow.outgoing,
    })),
    todayTransactions: todayTransactionsEntries.map((entry) => ({
      id: entry.id,
      reference: entry.reference,
      date: entry.entryDate.toISOString().slice(0, 10),
      partyName: entry.partyName ?? entry.particular,
      particular: entry.particular,
      amount: Number(entry.amount),
      direction: entry.direction,
      status: entry.status,
    })),

    // Division Financial Overview
    divisionFinancials,
    overallFinancials,
  };
});

