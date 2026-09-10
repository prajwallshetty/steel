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
import { listCustomers } from "@/modules/customers/customer-service";
import { listCustomerOutstanding } from "@/modules/customer-outstanding/customer-outstanding-service";
import { listPartnerPayments } from "@/modules/receipt-payment/partner-payment-service";
import { listVendors } from "@/modules/vendors/vendor-service";
import { listVendorOutstanding } from "@/modules/vendor-outstanding/vendor-outstanding-service";
import { listStaff } from "@/modules/staff/staff-service";
import {
  getCustomerLedger,
  getVendorLedger,
  getConsolidatedLedger,
} from "@/modules/receipt-payment/receipt-service";
import { listUsers } from "@/modules/users/user-service";
import { listBranches } from "@/modules/branches/branch-service";
import { listAuditLog } from "@/modules/audit/audit-queries";

/**
 * Reporting.
 *
 * Every report is scoped exactly like the screens it summarises, so a report
 * can never become a side channel that reveals another branch's numbers.
 */

export type ReportKind =
  | "quotations"
  | "customers"
  | "customer-outstanding"
  | "customer-payments"
  | "vendors"
  | "vendor-outstanding"
  | "vendor-payments"
  | "staff"
  | "users"
  | "branches"
  | "audit"
  | "ledger"
  | "gst"
  | "manager-performance"
  | "branch-performance";

export interface ReportFilters {
  readonly search?: string;
  readonly from?: string;
  readonly to?: string;
  readonly branchId?: string;
  readonly status?: string;
  readonly paymentMethod?: string;
  readonly direction?: string;
  readonly sortBy?: string;
  readonly customerId?: string;
  readonly vendorId?: string;
  readonly partyType?: string;
  readonly action?: string;
  readonly entity?: string;
}

export interface ReportTable {
  readonly title: string;
  readonly columns: readonly { key: string; label: string; numeric?: boolean }[];
  readonly rows: readonly Record<string, string | number>[];
}

const SETTLED: LedgerStatus[] = [LedgerStatus.RECEIVED, LedgerStatus.CLEARED];

function formatDateValue(val: Date | string | null | undefined): string {
  if (!val) return "—";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function formatTimestampValue(val: Date | string | null | undefined): string {
  if (!val) return "—";
  if (val instanceof Date) return val.toISOString().replace("T", " ").slice(0, 19);
  return String(val).replace("T", " ").slice(0, 19);
}

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
      return customersReport(subject, filters);
    case "customer-outstanding":
      return customerOutstandingReport(subject, filters);
    case "customer-payments":
      return customerPaymentsReport(subject, filters);
    case "vendors":
      return vendorsReport(subject, filters);
    case "vendor-outstanding":
      return vendorOutstandingReport(subject, filters);
    case "vendor-payments":
      return vendorPaymentsReport(subject, filters);
    case "staff":
      return staffReport(subject, filters);
    case "users":
      return usersReport(subject, filters);
    case "branches":
      return branchesReport(subject);
    case "audit":
      return auditReport(subject, filters);
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
    title: "Quotations report",
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

async function customersReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const rows = await listCustomers(subject, {
    search: filters.search,
    branchId: filters.branchId,
  });

  return {
    title: "Customers report",
    columns: [
      { key: "name", label: "Party Name" },
      { key: "city", label: "Location" },
      { key: "garudaBalance", label: "Party Balance", numeric: true },
      { key: "currentDues", label: "Current Dues", numeric: true },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "gstNumber", label: "GSTIN" },
      { key: "branch", label: "Branch" },
      { key: "quotations", label: "Quotations", numeric: true },
    ],
    rows: rows.map((row) => ({
      name: row.name,
      city: row.city || "—",
      garudaBalance: row.garudaBalance,
      currentDues: row.currentDues,
      phone: row.phone ?? "—",
      email: row.email ?? "—",
      gstNumber: row.gstNumber ?? "—",
      branch: row.branchName,
      quotations: row.quotationCount,
    })),
  };
}

async function customerOutstandingReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const data = await listCustomerOutstanding(subject, {
    search: filters.search,
    branchId: filters.branchId,
    from: filters.from,
    to: filters.to,
    sortBy: filters.sortBy as any,
  });

  return {
    title: "Customer Outstanding report",
    columns: [
      { key: "name", label: "Customer Name" },
      { key: "location", label: "Location" },
      { key: "branch", label: "Branch" },
      { key: "outstanding", label: "Outstanding Dues", numeric: true },
      { key: "status", label: "Payment Status" },
      { key: "lastPayment", label: "Last Payment" },
      { key: "lastActivity", label: "Last Activity" },
    ],
    rows: data.items.map((item) => ({
      name: item.name,
      location: [item.city, item.state].filter(Boolean).join(", ") || "—",
      branch: item.branchName,
      outstanding: item.outstandingAmount,
      status: item.paymentStatus,
      lastPayment: item.lastPaymentDate ? formatDateValue(item.lastPaymentDate) : "No payments",
      lastActivity: formatDateValue(item.lastTransactionDate),
    })),
  };
}

async function customerPaymentsReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const page = await listPartnerPayments(subject, "CUSTOMER", {
    search: filters.search,
    from: filters.from,
    to: filters.to,
    status: filters.status as any,
    paymentMethod: filters.paymentMethod as any,
    direction: filters.direction as any,
    branchId: filters.branchId,
  });

  return {
    title: "Customer Payments report",
    columns: [
      { key: "reference", label: "Voucher No" },
      { key: "date", label: "Date" },
      { key: "direction", label: "Type" },
      { key: "customer", label: "Customer Name" },
      { key: "particular", label: "Description" },
      { key: "method", label: "Method" },
      { key: "referenceNo", label: "Note number" },
      { key: "amount", label: "Amount", numeric: true },
    ],
    rows: page.rows.map((row) => ({
      reference: row.reference,
      date: formatDateValue(row.entryDate),
      direction: row.direction === "CREDIT" ? "Receipt" : "Payment",
      customer: row.partyName,
      particular: row.particular,
      method: row.paymentMethod.replace(/_/g, " ").toLowerCase(),
      referenceNo: row.referenceNo ?? "—",
      amount: Number(row.amount),
    })),
  };
}

async function vendorsReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const rows = await listVendors(subject, {
    search: filters.search,
    branchId: filters.branchId,
  });

  return {
    title: "Vendors report",
    columns: [
      { key: "name", label: "Vendor Name" },
      { key: "balance", label: "Balance", numeric: true },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "gstNumber", label: "GSTIN" },
      { key: "location", label: "City / State" },
      { key: "branch", label: "Branch" },
    ],
    rows: rows.map((v) => ({
      name: v.name,
      balance: v.balance,
      phone: v.phone ?? "—",
      email: v.email ?? "—",
      gstNumber: v.gstNumber ?? "—",
      location: [v.city, v.state].filter(Boolean).join(", ") || "—",
      branch: v.branchName,
    })),
  };
}

async function vendorOutstandingReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const data = await listVendorOutstanding(subject, {
    search: filters.search,
    branchId: filters.branchId,
    from: filters.from,
    to: filters.to,
    sortBy: filters.sortBy as any,
  });

  return {
    title: "Vendor Outstanding report",
    columns: [
      { key: "name", label: "Vendor Name" },
      { key: "location", label: "Location" },
      { key: "branch", label: "Branch" },
      { key: "payable", label: "Total Payable", numeric: true },
      { key: "paid", label: "Total Paid", numeric: true },
      { key: "outstanding", label: "Outstanding Liability", numeric: true },
      { key: "status", label: "Payment Status" },
      { key: "lastPayment", label: "Last Payment" },
      { key: "lastActivity", label: "Last Activity" },
    ],
    rows: data.items.map((item) => ({
      name: item.name,
      location: [item.city, item.state].filter(Boolean).join(", ") || "—",
      branch: item.branchName,
      payable: item.totalPayable,
      paid: item.totalPaid,
      outstanding: item.outstandingAmount,
      status: item.paymentStatus,
      lastPayment: item.lastPaymentDate ? formatDateValue(item.lastPaymentDate) : "No payments",
      lastActivity: formatDateValue(item.lastTransactionDate),
    })),
  };
}

async function vendorPaymentsReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const page = await listPartnerPayments(subject, "VENDOR", {
    search: filters.search,
    from: filters.from,
    to: filters.to,
    status: filters.status as any,
    paymentMethod: filters.paymentMethod as any,
    direction: filters.direction as any,
    branchId: filters.branchId,
  });

  return {
    title: "Vendor Payments report",
    columns: [
      { key: "reference", label: "Voucher No" },
      { key: "date", label: "Date" },
      { key: "direction", label: "Type" },
      { key: "vendor", label: "Vendor Name" },
      { key: "particular", label: "Description" },
      { key: "method", label: "Method" },
      { key: "referenceNo", label: "Note number" },
      { key: "amount", label: "Amount", numeric: true },
    ],
    rows: page.rows.map((row) => ({
      reference: row.reference,
      date: formatDateValue(row.entryDate),
      direction: row.direction === "CREDIT" ? "Receipt" : "Payment",
      vendor: row.partyName,
      particular: row.particular,
      method: row.paymentMethod.replace(/_/g, " ").toLowerCase(),
      referenceNo: row.referenceNo ?? "—",
      amount: Number(row.amount),
    })),
  };
}

async function staffReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const rows = await listStaff(subject, {
    search: filters.search,
    branchId: filters.branchId,
  });

  return {
    title: "Staff Members report",
    columns: [
      { key: "name", label: "Staff Name" },
      { key: "designation", label: "Designation" },
      { key: "balance", label: "Balance", numeric: true },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "branch", label: "Branch" },
    ],
    rows: rows.map((s) => ({
      name: s.name,
      designation: s.designation ?? "Staff",
      balance: s.balance,
      phone: s.phone ?? "—",
      email: s.email ?? "—",
      branch: s.branchName,
    })),
  };
}

async function usersReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const rows = await listUsers(subject, {
    search: filters.search,
    branchId: filters.branchId,
  });

  return {
    title: "Users report",
    columns: [
      { key: "name", label: "Name" },
      { key: "username", label: "Username" },
      { key: "role", label: "Role" },
      { key: "branch", label: "Branch" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "status", label: "Status" },
    ],
    rows: rows.map((u) => ({
      name: u.name,
      username: u.username,
      role: u.role,
      branch: u.branchName ?? "All branches",
      email: u.email ?? "—",
      phone: u.phone ?? "—",
      status: u.status,
    })),
  };
}

async function branchesReport(subject: ScopeSubject): Promise<ReportTable> {
  const rows = await listBranches(subject, { includeArchived: true });

  return {
    title: "Divisions report",
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Division Name" },
      { key: "state", label: "State" },
      { key: "startingBalance", label: "Starting Balance", numeric: true },
      { key: "closingBalance", label: "Closing Balance", numeric: true },
      { key: "cashInHand", label: "Cash in Hand", numeric: true },
      { key: "userCount", label: "Users", numeric: true },
      { key: "status", label: "Status" },
    ],
    rows: rows.map((b) => ({
      code: b.code,
      name: b.name,
      state: b.state,
      startingBalance: b.startingBalance,
      closingBalance: b.closingBalance,
      cashInHand: b.cashInHand,
      userCount: b.userCount,
      status: b.status,
    })),
  };
}

async function auditReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  const rows = await listAuditLog(subject, {
    search: filters.search,
    action: filters.action as any,
    entity: filters.entity,
    branchId: filters.branchId,
    from: filters.from,
    to: filters.to,
  });

  return {
    title: "Audit Log report",
    columns: [
      { key: "timestamp", label: "When" },
      { key: "userName", label: "Who" },
      { key: "action", label: "Action" },
      { key: "entity", label: "Entity" },
      { key: "summary", label: "Summary" },
      { key: "branch", label: "Branch" },
      { key: "ipAddress", label: "IP Address" },
    ],
    rows: rows.map((row) => ({
      timestamp: formatTimestampValue(row.createdAt),
      userName: row.userName,
      action: row.action,
      entity: row.entity,
      summary: row.summary,
      branch: row.branchName ?? "—",
      ipAddress: row.ipAddress ?? "—",
    })),
  };
}

async function ledgerReport(
  subject: ScopeSubject,
  filters: ReportFilters,
): Promise<ReportTable> {
  let ledger = null;
  let title = "Consolidated Ledger report";

  if (filters.partyType === "vendor" && filters.vendorId) {
    ledger = await getVendorLedger(subject, filters.vendorId, {
      from: filters.from,
      to: filters.to,
      branchId: filters.branchId,
    });
    title = `Vendor Ledger - ${ledger.vendorName}`;
  } else if (filters.partyType === "customer" && filters.customerId) {
    ledger = await getCustomerLedger(subject, filters.customerId, {
      from: filters.from,
      to: filters.to,
      branchId: filters.branchId,
    });
    title = `Customer Ledger - ${ledger.customerName}`;
  } else {
    ledger = await getConsolidatedLedger(subject, {
      from: filters.from,
      to: filters.to,
      branchId: filters.branchId,
    });
  }

  return {
    title,
    columns: [
      { key: "date", label: "Date" },
      { key: "voucherNo", label: "Voucher No" },
      { key: "type", label: "Type" },
      { key: "partyName", label: "Party Name" },
      { key: "description", label: "Description" },
      { key: "debit", label: "Debit (+)", numeric: true },
      { key: "credit", label: "Credit (-)", numeric: true },
      { key: "balance", label: "Balance", numeric: true },
    ],
    rows: ledger.rows.map((row: any) => ({
      date: formatDateValue(row.date),
      voucherNo: row.voucherNo,
      type: row.type,
      partyName: row.partyName ?? "—",
      description: row.description,
      debit: row.debit,
      credit: row.credit,
      balance: row.balance,
    })),
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
          {
            discountBase: "before-gst",
            highlighted: false,
            cdType: quotation.cdType as any,
          },
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
