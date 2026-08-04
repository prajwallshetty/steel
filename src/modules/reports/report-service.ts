import "server-only";
import { LedgerStatus, QuotationStatus } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import {
  ledgerScope,
  ledgerWhere,
  quotationScope,
  quotationWhere,
  type ScopeSubject,
} from "@/modules/permissions/scope";

/**
 * Reporting.
 *
 * Every report is scoped exactly like the screens it summarises, so a report
 * can never become a side channel that reveals another branch's numbers.
 */

export type ReportKind =
  | "quotations"
  | "customers"
  | "ledger"
  | "gst"
  | "manager-performance"
  | "branch-performance";

export interface ReportFilters {
  readonly from?: string;
  readonly to?: string;
  readonly branchId?: string;
  readonly status?: string;
}

export interface ReportTable {
  readonly title: string;
  readonly columns: readonly { key: string; label: string; numeric?: boolean }[];
  readonly rows: readonly Record<string, string | number>[];
}

const SETTLED: LedgerStatus[] = [LedgerStatus.RECEIVED, LedgerStatus.CLEARED];

function quotationFilter(subject: ScopeSubject, filters: ReportFilters) {
  const conditions: Record<string, unknown>[] = [
    quotationWhere(quotationScope(subject)),
    NOT_DELETED,
  ];
  if (filters.branchId) conditions.push({ branchId: filters.branchId });
  if (filters.from) conditions.push({ quotationDate: { gte: filters.from } });
  if (filters.to) conditions.push({ quotationDate: { lte: filters.to } });
  if (filters.status) {
    conditions.push({ status: filters.status as QuotationStatus });
  }
  return { AND: conditions };
}

function ledgerFilter(subject: ScopeSubject, filters: ReportFilters) {
  const conditions: Record<string, unknown>[] = [
    ledgerWhere(ledgerScope(subject)),
    NOT_DELETED,
  ];
  if (filters.branchId) conditions.push({ branchId: filters.branchId });
  if (filters.from) conditions.push({ entryDate: { gte: new Date(filters.from) } });
  if (filters.to) conditions.push({ entryDate: { lte: new Date(filters.to) } });
  if (filters.status) conditions.push({ status: filters.status as LedgerStatus });
  return { AND: conditions };
}

export async function buildReport(
  subject: ScopeSubject,
  kind: ReportKind,
  filters: ReportFilters,
): Promise<ReportTable> {
  switch (kind) {
    case "quotations":
      return quotationReport(subject, filters);
    case "customers":
      return customerReport(subject, filters);
    case "ledger":
      return ledgerReport(subject, filters);
    case "gst":
      return gstReport(subject, filters);
    case "manager-performance":
      return managerReport(subject, filters);
    case "branch-performance":
      return branchReport(subject, filters);
  }
}

async function quotationReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const rows = await prisma.quotation.findMany({
    where: quotationFilter(subject, filters),
    orderBy: { quotationDate: "desc" },
    take: 1000,
    include: {
      branch: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
  });

  return {
    title: "Quotation report",
    columns: [
      { key: "reference", label: "Reference" },
      { key: "date", label: "Date" },
      { key: "party", label: "Party" },
      { key: "brand", label: "Brand" },
      { key: "branch", label: "Branch" },
      { key: "manager", label: "Manager" },
      { key: "status", label: "Status" },
      { key: "quantity", label: "Qty (MT)", numeric: true },
      { key: "total", label: "Grand total", numeric: true },
    ],
    rows: rows.map((row) => ({
      reference: row.reference,
      date: row.quotationDate,
      party: row.partyName,
      brand: row.brand,
      branch: row.branch.name,
      manager: row.assignedTo?.name ?? "—",
      status: row.status,
      quantity: Number(row.totalQuantity),
      total: Number(row.grandTotal),
    })),
  };
}

async function customerReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const grouped = await prisma.quotation.groupBy({
    by: ["customerId", "partyName"],
    where: quotationFilter(subject, filters),
    _sum: { grandTotal: true, totalQuantity: true },
    _count: { _all: true },
  });

  return {
    title: "Customer report",
    columns: [
      { key: "customer", label: "Customer" },
      { key: "quotations", label: "Quotations", numeric: true },
      { key: "quantity", label: "Qty (MT)", numeric: true },
      { key: "value", label: "Total value", numeric: true },
    ],
    rows: grouped
      .map((row) => ({
        customer: row.partyName,
        quotations: row._count._all,
        quantity: Number(row._sum?.totalQuantity ?? 0),
        value: Number(row._sum?.grandTotal ?? 0),
      }))
      .sort((a, b) => b.value - a.value),
  };
}

async function ledgerReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const rows = await prisma.cashLedgerEntry.findMany({
    where: ledgerFilter(subject, filters),
    orderBy: { entryDate: "asc" },
    take: 1000,
    include: {
      customer: { select: { name: true } },
      branch: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  let balance = 0;
  return {
    title: "Cash ledger report",
    columns: [
      { key: "reference", label: "Reference" },
      { key: "date", label: "Date" },
      { key: "customer", label: "Customer" },
      { key: "particular", label: "Paid Through" },
      { key: "method", label: "Method" },
      { key: "referenceNo", label: "Note number" },
      { key: "status", label: "Status" },
      { key: "branch", label: "Branch" },
      { key: "createdBy", label: "Entered by" },
      { key: "credit", label: "Credit", numeric: true },
      { key: "debit", label: "Debit", numeric: true },
      { key: "balance", label: "Balance", numeric: true },
    ],
    rows: rows.map((row) => {
      const amount = Number(row.amount);
      const settled = SETTLED.includes(row.status);
      const credit = row.direction === "CREDIT" ? amount : 0;
      const debit = row.direction === "DEBIT" ? amount : 0;
      if (settled) balance += credit - debit;
      return {
        reference: row.reference,
        date: row.entryDate.toISOString().slice(0, 10),
        customer: row.customer?.name ?? "—",
        particular: row.particular,
        method: row.paymentMethod,
        referenceNo: row.referenceNo ?? "—",
        status: row.status,
        branch: row.branch.name,
        createdBy: row.createdBy?.name ?? "System",
        credit,
        debit,
        balance,
      };
    }),
  };
}

/**
 * GST summary.
 *
 * Recomputed from the stored rows rather than the denormalised total, because
 * the tax component is not a stored column — and it must be derived with the
 * same engine that printed the document.
 */
async function gstReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const quotations = await prisma.quotation.findMany({
    where: quotationFilter(subject, filters),
    orderBy: { quotationDate: "desc" },
    take: 1000,
    include: { rows: true, branch: { select: { name: true } } },
  });

  const { calculateRow } = await import("@/lib/quotation-engine");

  return {
    title: "GST report",
    columns: [
      { key: "reference", label: "Reference" },
      { key: "date", label: "Date" },
      { key: "party", label: "Party" },
      { key: "branch", label: "Branch" },
      { key: "taxable", label: "Taxable value", numeric: true },
      { key: "gst", label: "GST", numeric: true },
      { key: "total", label: "Total", numeric: true },
    ],
    rows: quotations.map((quotation) => {
      let taxable = 0;
      let gst = 0;
      for (const row of quotation.rows) {
        const calculated = calculateRow(
          {
            id: row.id,
            size: row.size,
            quantity: Number(row.quantity),
            basic: Number(row.basic),
            difference: Number(row.difference),
            loading: Number(row.loading),
            discountPercent: Number(row.discountPercent),
            gstPercent: Number(row.gstPercent),
            highlight: row.highlight,
          },
          { discountBase: "before-gst", highlighted: false },
        );
        taxable += calculated.taxableValue * calculated.quantity;
        gst += calculated.gstAmount * calculated.quantity;
      }
      return {
        reference: quotation.reference,
        date: quotation.quotationDate,
        party: quotation.partyName,
        branch: quotation.branch.name,
        taxable: Math.round(taxable),
        gst: Math.round(gst),
        total: Number(quotation.grandTotal),
      };
    }),
  };
}

async function managerReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const grouped = await prisma.quotation.groupBy({
    by: ["assignedToId"],
    where: quotationFilter(subject, filters),
    _sum: { grandTotal: true, totalQuantity: true },
    _count: { _all: true },
  });

  const names = await prisma.user.findMany({
    where: {
      id: {
        in: grouped
          .map((row) => row.assignedToId)
          .filter((id): id is string => Boolean(id)),
      },
    },
    select: { id: true, name: true, branch: { select: { name: true } } },
  });
  const byId = new Map(names.map((user) => [user.id, user]));

  return {
    title: "Manager performance",
    columns: [
      { key: "manager", label: "Manager" },
      { key: "branch", label: "Branch" },
      { key: "quotations", label: "Quotations", numeric: true },
      { key: "quantity", label: "Qty (MT)", numeric: true },
      { key: "value", label: "Total value", numeric: true },
    ],
    rows: grouped
      .map((row) => {
        const user = row.assignedToId ? byId.get(row.assignedToId) : undefined;
        return {
          manager: user?.name ?? "Unassigned",
          branch: user?.branch?.name ?? "—",
          quotations: row._count._all,
          quantity: Number(row._sum?.totalQuantity ?? 0),
          value: Number(row._sum?.grandTotal ?? 0),
        };
      })
      .sort((a, b) => b.value - a.value),
  };
}

async function branchReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const grouped = await prisma.quotation.groupBy({
    by: ["branchId"],
    where: quotationFilter(subject, filters),
    _sum: { grandTotal: true, totalQuantity: true },
    _count: { _all: true },
  });

  const branches = await prisma.branch.findMany({
    where: { id: { in: grouped.map((row) => row.branchId) } },
    select: { id: true, name: true, code: true, state: true },
  });
  const byId = new Map(branches.map((branch) => [branch.id, branch]));

  return {
    title: "Branch performance",
    columns: [
      { key: "branch", label: "Branch" },
      { key: "code", label: "Code" },
      { key: "state", label: "State" },
      { key: "quotations", label: "Quotations", numeric: true },
      { key: "quantity", label: "Qty (MT)", numeric: true },
      { key: "value", label: "Total value", numeric: true },
    ],
    rows: grouped
      .map((row) => {
        const branch = byId.get(row.branchId);
        return {
          branch: branch?.name ?? "Unknown",
          code: branch?.code ?? "—",
          state: branch?.state ?? "—",
          quotations: row._count._all,
          quantity: Number(row._sum?.totalQuantity ?? 0),
          value: Number(row._sum?.grandTotal ?? 0),
        };
      })
      .sort((a, b) => b.value - a.value),
  };
}

/**
 * Serialise a report to CSV.
 *
 * Fields are quoted and embedded quotes doubled per RFC 4180, and any value
 * that begins with a formula character is prefixed with an apostrophe — without
 * that, a customer named `=cmd|...` becomes a live formula when the export is
 * opened in Excel.
 */
export function toCsv(report: ReportTable): string {
  const escape = (value: string | number): string => {
    const text = String(value ?? "");
    const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${guarded.replace(/"/g, '""')}"`;
  };

  const header = report.columns.map((column) => escape(column.label)).join(",");
  const body = report.rows
    .map((row) => report.columns.map((column) => escape(row[column.key] ?? "")).join(","))
    .join("\r\n");

  return `${header}\r\n${body}`;
}
