import "server-only";
import { LedgerStatus, QuotationStatus, Role, UserStatus } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import {
  ledgerScope,
  ledgerWhere,
  quotationScope,
  quotationWhere,
  type ScopeSubject,
} from "@/modules/permissions/scope";

/**
 * Dashboard aggregates.
 *
 * Every figure is computed through the caller's scope, so the same code serves
 * all three roles: a Super Admin sees the organisation, a branch admin sees
 * their branch, and a manager sees their own book — without a separate query
 * path per role that could drift out of agreement.
 *
 * Reads the denormalised `grandTotal` column rather than replaying the pricing
 * engine over every row of every quotation.
 */

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
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export async function getDashboardMetrics(
  subject: ScopeSubject,
): Promise<DashboardMetrics> {
  const qScope = quotationWhere(quotationScope(subject));
  const lScope = ledgerWhere(ledgerScope(subject));

  const now = new Date();
  const today = isoDay(now);
  const monthStart = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const yearStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

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
  ] = await Promise.all([
    prisma.quotation.aggregate({
      _sum: { grandTotal: true },
      where: { AND: [quotationBase, { status: { in: REVENUE_STATUSES } }] },
    }),
    prisma.quotation.aggregate({
      _sum: { grandTotal: true },
      where: {
        AND: [
          quotationBase,
          { status: { in: REVENUE_STATUSES } },
          { quotationDate: { gte: monthStart } },
        ],
      },
    }),
    prisma.quotation.count({
      where: { AND: [quotationBase, { quotationDate: today }] },
    }),
    prisma.quotation.count({
      where: {
        AND: [quotationBase, { status: QuotationStatus.PENDING_APPROVAL }],
      },
    }),
    prisma.quotation.count({ where: quotationBase }),
    prisma.customer.count({
      where: {
        ...NOT_DELETED,
        ...(isSuper ? {} : { branchId: subject.branchId ?? "__none__" }),
      },
    }),
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [ledgerBase, { status: { in: SETTLED } }, { direction: "CREDIT" }],
      },
    }),
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: { AND: [ledgerBase, { status: LedgerStatus.PENDING }] },
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
          { quotationDate: { gte: isoDay(yearStart) } },
        ],
      },
      select: { quotationDate: true, grandTotal: true },
    }),
    isSuper
      ? prisma.quotation.groupBy({
          by: ["branchId"],
          where: { AND: [quotationBase, { status: { in: REVENUE_STATUSES } }] },
          _sum: { grandTotal: true },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    subject.role === Role.MANAGER
      ? Promise.resolve([])
      : prisma.quotation.groupBy({
          by: ["assignedToId"],
          where: { AND: [quotationBase, { status: { in: REVENUE_STATUSES } }] },
          _sum: { grandTotal: true },
          _count: { _all: true },
        }),
    prisma.cashLedgerEntry.groupBy({
      by: ["paymentMethod"],
      where: { AND: [ledgerBase, { status: { in: SETTLED } }] },
      _sum: { amount: true },
    }),
    prisma.quotation.findMany({
      where: quotationBase,
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
  ]);

  // Bucket by month in application code: the set is already narrowed to one
  // year and one scope, so this avoids a raw date_trunc query.
  const monthly = new Map<string, number>();
  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    monthly.set(date.toISOString().slice(0, 7), 0);
  }
  for (const row of revenueRows) {
    const key = row.quotationDate.slice(0, 7);
    if (monthly.has(key)) {
      monthly.set(key, (monthly.get(key) ?? 0) + Number(row.grandTotal));
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
  };
}
