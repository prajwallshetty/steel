import "server-only";
import {
  AuditAction,
  LedgerDirection,
  LedgerStatus,
  NotificationType,
  Prisma,
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
  type ScopeSubject,
} from "@/modules/permissions/scope";
import type { LedgerEntryInput, LedgerFilterInput } from "./ledger-schema";

/**
 * Cash ledger.
 *
 * Money is stored as `Decimal` and summed in the database. Balances are never
 * accumulated through JavaScript floats — `0.1 + 0.2` is the classic way to
 * lose a paisa per row, and a ledger that does not foot is worse than no
 * ledger at all.
 *
 * Only CLEARED and RECEIVED entries move the balance: PENDING is an
 * expectation, and CANCELLED/RETURNED never landed.
 */

/** Statuses that actually affect a balance. */
const SETTLED: readonly LedgerStatus[] = [
  LedgerStatus.RECEIVED,
  LedgerStatus.CLEARED,
];

export interface LedgerRow {
  readonly id: string;
  readonly reference: string;
  readonly entryDate: string;
  readonly direction: LedgerDirection;
  readonly amount: number;
  readonly paymentMethod: string;
  readonly referenceNo: string | null;
  readonly particular: string;
  readonly note: string | null;
  readonly status: LedgerStatus;
  readonly customerName: string | null;
  readonly quotationReference: string | null;
  readonly branchName: string;
  readonly createdByName: string;
  readonly approvedByName: string | null;
  readonly createdAt: string;
  /** Balance after this entry, oldest-first. Null when not settled. */
  readonly runningBalance: number;
}

export interface LedgerPage {
  readonly rows: readonly LedgerRow[];
  readonly openingBalance: number;
  readonly closingBalance: number;
  readonly totalCredit: number;
  readonly totalDebit: number;
  readonly pendingAmount: number;
  readonly count: number;
}

function buildWhere(
  subject: ScopeSubject,
  filters: LedgerFilterInput,
): Prisma.CashLedgerEntryWhereInput {
  const conditions: Prisma.CashLedgerEntryWhereInput[] = [
    ledgerWhere(ledgerScope(subject)),
    NOT_DELETED,
  ];

  if (filters.branchId) conditions.push({ branchId: filters.branchId });
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.paymentMethod) {
    conditions.push({ paymentMethod: filters.paymentMethod });
  }
  if (filters.customerId) conditions.push({ customerId: filters.customerId });
  if (filters.createdById) conditions.push({ createdById: filters.createdById });
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
        { customer: { name: { contains: term, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: conditions };
}

/**
 * The balance carried into the filtered window.
 *
 * Computed as the sum of every settled entry strictly before the window's start
 * date, within the same scope — so a date-filtered view still shows a truthful
 * opening figure rather than starting from zero.
 */
async function computeOpeningBalance(
  subject: ScopeSubject,
  filters: LedgerFilterInput,
): Promise<number> {
  if (!filters.from) return 0;

  const priorWhere = buildWhere(subject, { ...filters, from: undefined, to: undefined });

  const [credits, debits] = await Promise.all([
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          priorWhere,
          { entryDate: { lt: new Date(filters.from) } },
          { status: { in: [...SETTLED] } },
          { direction: LedgerDirection.CREDIT },
        ],
      },
    }),
    prisma.cashLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          priorWhere,
          { entryDate: { lt: new Date(filters.from) } },
          { status: { in: [...SETTLED] } },
          { direction: LedgerDirection.DEBIT },
        ],
      },
    }),
  ]);

  return (
    Number(credits._sum?.amount ?? 0) - Number(debits._sum?.amount ?? 0)
  );
}

export async function listLedger(
  subject: ScopeSubject,
  filters: LedgerFilterInput = {},
): Promise<LedgerPage> {
  const where = buildWhere(subject, filters);

  const [entries, openingBalance] = await Promise.all([
    prisma.cashLedgerEntry.findMany({
      where,
      // Oldest first so the running balance accumulates in real chronology;
      // the UI reverses for display.
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
      include: {
        customer: { select: { name: true } },
        vendor: { select: { name: true } },
        quotation: { select: { reference: true } },
        branch: { select: { name: true } },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
      take: 500,
    }),
    computeOpeningBalance(subject, filters),
  ]);

  let running = openingBalance;
  let totalCredit = 0;
  let totalDebit = 0;
  let pendingAmount = 0;

  const rows: LedgerRow[] = entries.map((entry) => {
    const amount = Number(entry.amount);
    const settled = SETTLED.includes(entry.status);

    if (settled) {
      if (entry.direction === LedgerDirection.CREDIT) {
        running += amount;
        totalCredit += amount;
      } else {
        running -= amount;
        totalDebit += amount;
      }
    } else if (entry.status === LedgerStatus.PENDING) {
      pendingAmount += amount;
    }

    return {
      id: entry.id,
      reference: entry.reference,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      direction: entry.direction,
      amount,
      paymentMethod: entry.paymentMethod,
      referenceNo: entry.referenceNo,
      particular: entry.particular,
      note: entry.note,
      status: entry.status,
      customerName: entry.customer?.name ?? entry.vendor?.name ?? entry.partyName ?? null,
      quotationReference: entry.quotation?.reference ?? null,
      branchName: entry.branch.name,
      createdByName: entry.createdBy?.name ?? "System",
      approvedByName: entry.approvedBy?.name ?? null,
      createdAt: entry.createdAt.toISOString(),
      runningBalance: running,
    };
  });

  return {
    rows,
    openingBalance,
    closingBalance: running,
    totalCredit,
    totalDebit,
    pendingAmount,
    count: rows.length,
  };
}

async function requireEntry(subject: ScopeSubject, id: string) {
  const entry = await prisma.cashLedgerEntry.findFirst({
    where: { AND: [{ id }, ledgerWhere(ledgerScope(subject)), NOT_DELETED] },
  });
  if (!entry) throw new RecordNotFoundError("Ledger entry");
  return entry;
}

export async function createLedgerEntry(
  subject: ScopeSubject,
  input: LedgerEntryInput,
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

  await assertLinksInBranch(input, branchId);

  // Only an approver may file an entry as already settled; everyone else's
  // entries start PENDING and must be approved.
  const canApprove = hasPermission(subject, PERMISSIONS.LEDGER_APPROVE);
  const status =
    canApprove || input.status === LedgerStatus.PENDING
      ? input.status
      : LedgerStatus.PENDING;

  const year = Number(input.entryDate.slice(0, 4));

  const entry = await prisma.$transaction(async (tx) => {
    const serial = await nextSequenceValue(branchId, "LEDGER", year, tx);
    return tx.cashLedgerEntry.create({
      data: {
        reference: formatReference(branch.code, "LEDGER", year, serial),
        entryDate: new Date(input.entryDate),
        branchId,
        customerId: input.customerId || null,
        quotationId: input.quotationId || null,
        direction: input.direction,
        amount: new Prisma.Decimal(input.amount),
        paymentMethod: input.paymentMethod,
        referenceNo: input.referenceNo?.trim() || null,
        particular: input.particular.trim(),
        note: input.note?.trim() || null,
        status,
        approvedById: canApprove && status !== LedgerStatus.PENDING ? subject.id : null,
        approvedAt: canApprove && status !== LedgerStatus.PENDING ? new Date() : null,
        createdById: subject.id,
        updatedById: subject.id,
      },
    });
  });

  await recordAudit({
    action: AuditAction.CREATE,
    entity: "CashLedgerEntry",
    entityId: entry.id,
    summary: `Recorded ${input.direction.toLowerCase()} of ${input.amount} (${entry.reference})`,
    userId: subject.id,
    branchId,
    newValue: {
      amount: input.amount,
      method: input.paymentMethod,
      status,
      particular: entry.particular,
    },
  });

  if (status === LedgerStatus.PENDING) {
    await notifyBranchAdmins(branchId, {
      type: NotificationType.LEDGER_APPROVAL_REQUIRED,
      title: "Ledger entry awaiting approval",
      body: `${entry.reference} — ${entry.particular} (${input.amount})`,
      link: `/ledger?highlight=${entry.id}`,
    });
  }

  return { id: entry.id };
}

export async function updateLedgerEntry(
  subject: ScopeSubject,
  id: string,
  input: LedgerEntryInput,
): Promise<{ id: string }> {
  const existing = await requireEntry(subject, id);

  const mayEdit = canMutateRecord(ledgerScope(subject), {
    branchId: existing.branchId,
    ownerIds: [existing.createdById],
  });
  if (!mayEdit) throw new ForbiddenError("You can only edit your own entries.");

  // A cleared entry has been reconciled against a bank statement; changing it
  // would silently rewrite a balance somebody has already signed off.
  if (existing.status === LedgerStatus.CLEARED && !hasPermission(subject, PERMISSIONS.LEDGER_APPROVE)) {
    throw new BusinessRuleError(
      "This entry is cleared. Ask an administrator to amend it.",
    );
  }

  await assertLinksInBranch(input, existing.branchId);

  const canApprove = hasPermission(subject, PERMISSIONS.LEDGER_APPROVE);
  const status = canApprove ? input.status : existing.status;

  const data = {
    entryDate: new Date(input.entryDate),
    customerId: input.customerId || null,
    quotationId: input.quotationId || null,
    direction: input.direction,
    amount: new Prisma.Decimal(input.amount),
    paymentMethod: input.paymentMethod,
    referenceNo: input.referenceNo?.trim() || null,
    particular: input.particular.trim(),
    note: input.note?.trim() || null,
    status,
  };

  await prisma.cashLedgerEntry.update({
    where: { id },
    data: { ...data, updatedById: subject.id },
  });

  await recordAudit({
    action: AuditAction.UPDATE,
    entity: "CashLedgerEntry",
    entityId: id,
    summary: `Updated ledger entry ${existing.reference}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: {
      amount: Number(existing.amount),
      status: existing.status,
      particular: existing.particular,
    },
    newValue: {
      amount: input.amount,
      status,
      particular: data.particular,
    },
  });

  return { id };
}

/** Approve or otherwise re-status an entry. */
export async function setLedgerStatus(
  subject: ScopeSubject,
  id: string,
  status: LedgerStatus,
): Promise<void> {
  if (!hasPermission(subject, PERMISSIONS.LEDGER_APPROVE)) {
    throw new ForbiddenError("You do not have permission to approve entries.");
  }
  const existing = await requireEntry(subject, id);

  if (existing.status === status) return;

  await prisma.cashLedgerEntry.update({
    where: { id },
    data: {
      status,
      approvedById: SETTLED.includes(status) ? subject.id : null,
      approvedAt: SETTLED.includes(status) ? new Date() : null,
      updatedById: subject.id,
    },
  });

  await recordAudit({
    action: SETTLED.includes(status) ? AuditAction.APPROVE : AuditAction.UPDATE,
    entity: "CashLedgerEntry",
    entityId: id,
    summary: `Marked ${existing.reference} as ${status.toLowerCase()}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { status: existing.status },
    newValue: { status },
  });
}

export async function deleteLedgerEntry(
  subject: ScopeSubject,
  id: string,
): Promise<void> {
  if (!hasPermission(subject, PERMISSIONS.LEDGER_DELETE)) {
    throw new ForbiddenError("You do not have permission to delete entries.");
  }
  const existing = await requireEntry(subject, id);

  if (existing.status === LedgerStatus.CLEARED) {
    throw new BusinessRuleError(
      "A cleared entry cannot be deleted. Post a reversing entry instead so the trail is preserved.",
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
    summary: `Deleted ledger entry ${existing.reference}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { amount: Number(existing.amount), status: existing.status },
  });
}

/** Reject a forged customer or quotation id pointing outside the branch. */
async function assertLinksInBranch(
  input: LedgerEntryInput,
  branchId: string,
): Promise<void> {
  if (input.customerId) {
    const found = await prisma.customer.count({
      where: { id: input.customerId, branchId, ...NOT_DELETED },
    });
    if (!found) {
      throw new BusinessRuleError("That customer does not belong to this branch.");
    }
  }
  if (input.quotationId) {
    const found = await prisma.quotation.count({
      where: { id: input.quotationId, branchId, ...NOT_DELETED },
    });
    if (!found) {
      throw new BusinessRuleError("That quotation does not belong to this branch.");
    }
  }
}
