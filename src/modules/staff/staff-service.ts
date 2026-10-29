import "server-only";
import {
  AuditAction,
  LedgerDirection,
  LedgerStatus,
  PaymentMethod,
  Prisma,
} from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import { recordAudit, diffFields } from "@/modules/audit/audit-service";
import { formatReference, nextSequenceValue } from "@/modules/shared/sequence";
import {
  BusinessRuleError,
  RecordNotFoundError,
} from "@/modules/shared/action-result";
import {
  branchWhere,
  ledgerScope,
  ledgerWhere,
  resolveWriteBranch,
  type ScopeSubject,
} from "@/modules/permissions/scope";
import type { StaffInput, StaffPaymentInput } from "./staff-schema";

export interface StaffSummary {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly designation: string | null;
  readonly address: string | null;
  readonly balance: number;
  readonly branchId: string;
  readonly branchName: string;
  readonly createdAt: string;
}

export async function listStaff(
  subject: ScopeSubject,
  filters: { readonly search?: string; readonly branchId?: string } = {},
): Promise<StaffSummary[]> {
  const staffMembers = await prisma.staff.findMany({
    where: {
      AND: [
        branchWhere(subject),
        NOT_DELETED,
        filters.branchId ? { branchId: filters.branchId } : {},
        filters.search?.trim()
          ? {
              OR: [
                { name: { contains: filters.search.trim(), mode: "insensitive" } },
                { phone: { contains: filters.search.trim(), mode: "insensitive" } },
                { designation: { contains: filters.search.trim(), mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    include: {
      branch: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return staffMembers.map((staff) => ({
    id: staff.id,
    name: staff.name,
    phone: staff.phone,
    email: staff.email,
    designation: staff.designation,
    address: staff.address,
    balance: Number(staff.balance),
    branchId: staff.branchId,
    branchName: staff.branch.name,
    createdAt: staff.createdAt.toISOString(),
  }));
}

export interface StaffCollectionRow {
  readonly id: string;
  readonly reference: string;
  readonly staffId: string;
  readonly staffName: string;
  readonly customerName: string | null;
  readonly entryDate: string;
  readonly createdAt: string;
  readonly amount: number;
  readonly paymentMethod: string;
  readonly referenceNo: string | null;
  readonly invoiceReference: string | null;
  readonly particular: string;
  readonly note: string | null;
  readonly status: LedgerStatus;
  readonly branchName: string;
}

export interface StaffCollectionsPage {
  readonly rows: readonly StaffCollectionRow[];
  readonly total: number;
  readonly totalAmount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
}

export interface StaffCollectionFilters {
  readonly search?: string;
  readonly staffId?: string;
  readonly branchId?: string;
  readonly paymentMethod?: string;
  readonly from?: string;
  readonly to?: string;
  readonly page?: number;
}

const COLLECTIONS_PAGE_SIZE = 25;

/**
 * Money received through a staff member: ledger entries carrying a `staffId`
 * with direction CREDIT. Read-only: nothing here writes to the ledger or to
 * any balance. Soft-deleted and cancelled/returned entries are excluded from
 * the amount total but listed (with their status) so nothing silently vanishes.
 */
export async function listStaffCollections(
  subject: ScopeSubject,
  filters: StaffCollectionFilters = {},
): Promise<StaffCollectionsPage> {
  const term = filters.search?.trim();
  const dateOk = (v?: string) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);
  const from = dateOk(filters.from);
  const to = dateOk(filters.to);

  const where: Prisma.CashLedgerEntryWhereInput = {
    AND: [
      ledgerWhere(ledgerScope(subject)),
      NOT_DELETED,
      { direction: LedgerDirection.CREDIT },
      filters.staffId ? { staffId: filters.staffId } : { staffId: { not: null } },
      filters.branchId ? { branchId: filters.branchId } : {},
      filters.paymentMethod
        ? { paymentMethod: filters.paymentMethod as PaymentMethod }
        : {},
      from ? { entryDate: { gte: from } } : {},
      to ? { entryDate: { lte: to } } : {},
      term
        ? {
            OR: [
              { reference: { contains: term, mode: "insensitive" } },
              { referenceNo: { contains: term, mode: "insensitive" } },
              { particular: { contains: term, mode: "insensitive" } },
              { note: { contains: term, mode: "insensitive" } },
              { staff: { name: { contains: term, mode: "insensitive" } } },
              { customer: { name: { contains: term, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };

  const [total, sum] = await Promise.all([
    prisma.cashLedgerEntry.count({ where }),
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          where,
          { status: { in: [LedgerStatus.RECEIVED, LedgerStatus.CLEARED] } },
        ],
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / COLLECTIONS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(filters.page ?? 1) || 1), pageCount);

  const entries = await prisma.cashLedgerEntry.findMany({
    where,
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * COLLECTIONS_PAGE_SIZE,
    take: COLLECTIONS_PAGE_SIZE,
    include: {
      staff: { select: { id: true, name: true } },
      customer: { select: { name: true } },
      quotation: { select: { reference: true } },
      branch: { select: { name: true } },
    },
  });

  return {
    rows: entries.map((e) => ({
      id: e.id,
      reference: e.reference,
      staffId: e.staff?.id ?? "",
      staffName: e.staff?.name ?? e.partyName ?? "—",
      customerName: e.customer?.name ?? null,
      entryDate: e.entryDate.toISOString().slice(0, 10),
      createdAt: e.createdAt.toISOString(),
      amount: Number(e.amount),
      paymentMethod: e.paymentMethod,
      referenceNo: e.referenceNo,
      invoiceReference: e.quotation?.reference ?? null,
      particular: e.particular,
      note: e.note,
      status: e.status,
      branchName: e.branch.name,
    })),
    total,
    totalAmount: Number(sum._sum?.amount ?? 0),
    page,
    pageSize: COLLECTIONS_PAGE_SIZE,
    pageCount,
  };
}

export async function getStaffCashInHand(
  subject: ScopeSubject,
  branchId?: string,
): Promise<number> {
  const staffMembers = await prisma.staff.findMany({
    where: {
      AND: [
        branchWhere(subject),
        NOT_DELETED,
        branchId ? { branchId } : {},
      ],
    },
    select: { balance: true },
  });

  return staffMembers.reduce((sum, s) => sum + Number(s.balance), 0);
}

export async function listSelectableStaff(
  subject: ScopeSubject,
  branchId?: string,
) {
  return prisma.staff.findMany({
    where: {
      AND: [
        branchWhere(subject),
        NOT_DELETED,
        branchId ? { branchId } : {},
      ],
    },
    select: { id: true, name: true, designation: true, branchId: true },
    orderBy: { name: "asc" },
  });
}

export async function getStaff(subject: ScopeSubject, id: string) {
  const staff = await prisma.staff.findFirst({
    where: { AND: [{ id }, branchWhere(subject), NOT_DELETED] },
  });
  if (!staff) throw new RecordNotFoundError("Staff");
  return staff;
}

export async function createStaff(
  subject: ScopeSubject,
  input: StaffInput,
): Promise<{ id: string }> {
  const branchId = resolveWriteBranch(subject, input.branchId || null);
  const nameTrimmed = input.name.trim();

  const existing = await prisma.staff.findFirst({
    where: {
      branchId,
      name: { equals: nameTrimmed, mode: "insensitive" },
    },
  });

  if (existing) {
    if (existing.deletedAt === null) {
      throw new BusinessRuleError(
        `A staff member named "${nameTrimmed}" already exists in this branch.`,
      );
    }

    const restored = await prisma.staff.update({
      where: { id: existing.id },
      data: {
        name: nameTrimmed,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        designation: input.designation?.trim() || null,
        address: input.address?.trim() || null,
        balance: input.balance ?? 0,
        deletedAt: null,
        updatedById: subject.id,
      },
    });

    await recordAudit({
      action: AuditAction.RESTORE,
      entity: "Staff",
      entityId: restored.id,
      summary: `Restored staff member ${restored.name}`,
      userId: subject.id,
      branchId,
      newValue: { name: restored.name },
    });

    return { id: restored.id };
  }

  const staff = await prisma.staff.create({
    data: {
      name: nameTrimmed,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      designation: input.designation?.trim() || null,
      address: input.address?.trim() || null,
      balance: input.balance ?? 0,
      branchId,
      createdById: subject.id,
      updatedById: subject.id,
    },
  });

  await recordAudit({
    action: AuditAction.CREATE,
    entity: "Staff",
    entityId: staff.id,
    summary: `Created staff member ${staff.name}`,
    userId: subject.id,
    branchId,
    newValue: { name: staff.name },
  });

  return { id: staff.id };
}

export async function updateStaff(
  subject: ScopeSubject,
  id: string,
  input: StaffInput,
): Promise<{ id: string }> {
  const existing = await getStaff(subject, id);
  const nameTrimmed = input.name.trim();

  const duplicate = await prisma.staff.findFirst({
    where: {
      branchId: existing.branchId,
      name: { equals: nameTrimmed, mode: "insensitive" },
      id: { not: id },
      deletedAt: null,
    },
  });

  if (duplicate) {
    throw new BusinessRuleError(
      `A staff member named "${nameTrimmed}" already exists in this branch.`,
    );
  }

  const data = {
    name: nameTrimmed,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    designation: input.designation?.trim() || null,
    address: input.address?.trim() || null,
    balance: input.balance ?? 0,
  };

  await prisma.$transaction(async (tx) => {
    await tx.staff.update({
      where: { id },
      data: { ...data, updatedById: subject.id },
    });

    if (data.name !== existing.name) {
      await tx.cashLedgerEntry.updateMany({
        where: { staffId: id },
        data: { partyName: data.name },
      });
    }
  });

  const changes = diffFields(existing as unknown as Record<string, unknown>, data);
  if (changes) {
    await recordAudit({
      action: AuditAction.UPDATE,
      entity: "Staff",
      entityId: id,
      summary: `Updated staff member ${data.name}`,
      userId: subject.id,
      branchId: existing.branchId,
      oldValue: changes.before,
      newValue: changes.after,
    });
  }

  return { id };
}

export async function deleteStaff(
  subject: ScopeSubject,
  id: string,
): Promise<void> {
  const existing = await getStaff(subject, id);

  const referenced = await prisma.cashLedgerEntry.count({
    where: { staffId: id, ...NOT_DELETED },
  });
  if (referenced > 0) {
    throw new BusinessRuleError(
      `${existing.name} is referenced by ${referenced} ledger entry and cannot be removed.`,
    );
  }

  await prisma.staff.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: subject.id },
  });

  await recordAudit({
    action: AuditAction.DELETE,
    entity: "Staff",
    entityId: id,
    summary: `Deleted staff member ${existing.name}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { name: existing.name },
  });
}

export async function recordStaffTransaction(
  subject: ScopeSubject,
  input: StaffPaymentInput,
): Promise<{ id: string }> {
  const staff = await getStaff(subject, input.staffId);
  const branchId = staff.branchId;

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, ...NOT_DELETED },
    select: { code: true, name: true, status: true },
  });
  if (!branch) throw new RecordNotFoundError("Branch");
  if (branch.status !== "ACTIVE") {
    throw new BusinessRuleError(`Branch ${branch.name} is not active.`);
  }

  const direction = input.type === "CASH_OUT" ? LedgerDirection.DEBIT : LedgerDirection.CREDIT;
  const year = Number(input.entryDate.slice(0, 4));
  const seqKind = input.type === "CASH_OUT" ? "PAYMENT" : "RECEIPT";

  const entry = await prisma.$transaction(async (tx) => {
    const serial = await nextSequenceValue(branchId, seqKind, year, tx);
    const reference = formatReference(branch.code, seqKind, year, serial);

    const ledgerEntry = await tx.cashLedgerEntry.create({
      data: {
        reference,
        entryDate: new Date(input.entryDate),
        branchId,
        staffId: staff.id,
        partyType: "EMPLOYEE",
        partyName: staff.name,
        direction,
        amount: new Prisma.Decimal(input.amount),
        paymentMethod: input.paymentMethod as any,
        referenceNo: input.referenceNo?.trim() || null,
        particular: input.particular.trim(),
        note: input.note?.trim() || null,
        status: LedgerStatus.RECEIVED,
        approvedById: subject.id,
        approvedAt: new Date(),
        createdById: subject.id,
        updatedById: subject.id,
      },
    });

    // CASH_OUT (DEBIT): paid money to staff -> balance = balance - amount
    // CASH_IN (CREDIT): received money from staff -> balance = balance + amount
    const balanceChange = input.type === "CASH_OUT" ? -input.amount : input.amount;
    await tx.staff.update({
      where: { id: staff.id },
      data: {
        balance: { increment: balanceChange },
        updatedById: subject.id,
      },
    });

    return ledgerEntry;
  });

  await recordAudit({
    action: AuditAction.CREATE,
    entity: "CashLedgerEntry",
    entityId: entry.id,
    summary: `Recorded ${input.type === "CASH_OUT" ? "payment" : "receipt"} of ₹${input.amount} for staff ${staff.name} (${entry.reference})`,
    userId: subject.id,
    branchId,
    newValue: {
      amount: input.amount,
      staffName: staff.name,
      type: input.type,
      paymentMethod: input.paymentMethod,
    },
  });

  return { id: entry.id };
}
