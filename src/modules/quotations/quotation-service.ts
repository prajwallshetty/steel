import "server-only";
import { AuditAction, NotificationType, Prisma, QuotationStatus, Role, LedgerDirection, LedgerStatus } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import type { Quotation } from "@/types/quotation";
import { calculateQuotation } from "@/lib/quotation-engine";
import { getSettings } from "@/modules/settings/settings-service";
import { recordAudit } from "@/modules/audit/audit-service";
import {
  notifyBranchAdmins,
  notifyUsers,
} from "@/modules/notifications/notification-service";
import { formatReference, nextSequenceValue } from "@/modules/shared/sequence";
import {
  BusinessRuleError,
  RecordNotFoundError,
} from "@/modules/shared/action-result";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import {
  ForbiddenError,
  canMutateRecord,
  quotationScope,
  quotationWhere,
  resolveWriteBranch,
  type ScopeSubject,
} from "@/modules/permissions/scope";
import {
  QUOTATION_INCLUDE,
  toDomainQuotation,
  type QuotationRecord,
} from "./quotation-mapper";
import type { QuotationDraftInput } from "@/lib/validation/quotation-schema";

/**
 * Quotation service.
 *
 * Every read is scoped and every write is authorised here, so no route or
 * component has to remember to filter by branch. The pricing engine is called
 * for the denormalised totals only — the printed document is still produced by
 * the untouched engine + sheet + PDF stack from the same domain type as before.
 */

export interface QuotationFilters {
  readonly search?: string;
  readonly status?: QuotationStatus;
  readonly branchId?: string;
  readonly customerId?: string;
  readonly assignedToId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly take?: number;
  readonly skip?: number;
}

export interface QuotationListItem {
  readonly id: string;
  readonly reference: string;
  readonly status: QuotationStatus;
  readonly partyName: string;
  readonly brand: string;
  readonly location: string;
  readonly quotationDate: string;
  readonly grandTotal: number;
  readonly totalQuantity: number;
  readonly branchName: string;
  readonly createdByName: string;
  readonly updatedAt: string;
}

/** Compose the caller's scope with the requested filters. */
function buildWhere(
  subject: ScopeSubject,
  filters: QuotationFilters,
): Prisma.QuotationWhereInput {
  const scoped = quotationWhere(quotationScope(subject));

  const conditions: Prisma.QuotationWhereInput[] = [scoped, NOT_DELETED];

  if (filters.status) conditions.push({ status: filters.status });
  if (filters.customerId) conditions.push({ customerId: filters.customerId });
  if (filters.assignedToId) {
    conditions.push({ assignedToId: filters.assignedToId });
  }
  // A branch filter narrows within the scope; it can never widen it, because
  // the scope clause is ANDed alongside rather than replaced.
  if (filters.branchId) conditions.push({ branchId: filters.branchId });
  if (filters.from) conditions.push({ quotationDate: { gte: filters.from } });
  if (filters.to) conditions.push({ quotationDate: { lte: filters.to } });

  if (filters.search?.trim()) {
    const term = filters.search.trim();
    conditions.push({
      OR: [
        { reference: { contains: term, mode: "insensitive" } },
        { partyName: { contains: term, mode: "insensitive" } },
        { brand: { contains: term, mode: "insensitive" } },
        { location: { contains: term, mode: "insensitive" } },
        { vehicleNo: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  return { AND: conditions };
}

export async function listQuotations(
  subject: ScopeSubject,
  filters: QuotationFilters = {},
): Promise<{ items: QuotationListItem[]; total: number }> {
  const where = buildWhere(subject, filters);

  const [records, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: [{ quotationDate: "desc" }, { createdAt: "desc" }],
      take: filters.take ?? 50,
      skip: filters.skip ?? 0,
      include: {
        branch: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.quotation.count({ where }),
  ]);

  return {
    total,
    items: records.map((record) => ({
      id: record.id,
      reference: record.reference,
      status: record.status,
      partyName: record.partyName,
      brand: record.brand,
      location: record.location,
      quotationDate: record.quotationDate,
      grandTotal: Number(record.grandTotal),
      totalQuantity: Number(record.totalQuantity),
      branchName: record.branch.name,
      createdByName: record.createdBy?.name ?? "System",
      updatedAt: record.updatedAt.toISOString(),
    })),
  };
}

/**
 * Fetch one quotation, scoped.
 *
 * The scope is applied in the query rather than checked afterwards, so an
 * out-of-scope id is indistinguishable from a non-existent one — it does not
 * confirm that another branch's reference exists.
 */
export async function getQuotation(
  subject: ScopeSubject,
  id: string,
): Promise<Quotation | null> {
  const record = await prisma.quotation.findFirst({
    where: { AND: [{ id }, quotationWhere(quotationScope(subject)), NOT_DELETED] },
    include: QUOTATION_INCLUDE,
  });
  return record ? toDomainQuotation(record) : null;
}

async function requireQuotation(
  subject: ScopeSubject,
  id: string,
): Promise<QuotationRecord> {
  const record = await prisma.quotation.findFirst({
    where: { AND: [{ id }, quotationWhere(quotationScope(subject)), NOT_DELETED] },
    include: QUOTATION_INCLUDE,
  });
  if (!record) throw new RecordNotFoundError("Quotation");
  return record;
}

/** Totals for the denormalised columns that reporting reads. */
async function computeTotals(
  draft: QuotationDraftInput,
  branchId: string,
): Promise<{ grandTotal: number; totalQuantity: number }> {
  const settings = await getSettings(branchId);
  const calculated = calculateQuotation(
    {
      id: "pending",
      reference: "pending",
      status: draft.status,
      header: draft.header,
      rows: draft.rows,
      remarks: draft.remarks,
      createdBy: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    settings,
  );
  return {
    grandTotal: calculated.totals.grandTotal,
    totalQuantity: calculated.totals.totalQuantity,
  };
}

const rowsToCreate = (draft: QuotationDraftInput) =>
  draft.rows.map((row, position) => ({
    position,
    size: row.size,
    quantity: new Prisma.Decimal(row.quantity),
    basic: new Prisma.Decimal(row.basic),
    difference: new Prisma.Decimal(row.difference),
    loading: new Prisma.Decimal(row.loading),
    discountPercent: new Prisma.Decimal(row.discountPercent),
    gstPercent: new Prisma.Decimal(row.gstPercent),
    highlight: row.highlight,
  }));

export interface CreateQuotationInput extends QuotationDraftInput {
  readonly branchId?: string | null;
  readonly customerId?: string | null;
  readonly assignedToId?: string | null;
}

export async function createQuotation(
  subject: ScopeSubject,
  input: CreateQuotationInput,
): Promise<Quotation> {
  const branchId = resolveWriteBranch(subject, input.branchId);

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, ...NOT_DELETED },
    select: { id: true, code: true, name: true, status: true },
  });
  if (!branch) throw new RecordNotFoundError("Branch");
  if (branch.status !== "ACTIVE") {
    throw new BusinessRuleError(
      `Branch ${branch.name} is ${branch.status.toLowerCase()} and cannot take new quotations.`,
    );
  }

  await assertCustomerInBranch(input.customerId, branchId);

  // A manager always owns what they create; an admin may assign it onward.
  const assignedToId =
    subject.role === Role.MANAGER
      ? subject.id
      : (input.assignedToId ?? subject.id);

  const totals = await computeTotals(input, branchId);
  const year = Number(input.header.date.slice(0, 4));

  const created = await prisma.$transaction(async (tx) => {
    const serial = await nextSequenceValue(branchId, "QUOTATION", year, tx);
    const reference = formatReference(branch.code, "QUOTATION", year, serial);

    const q = await tx.quotation.create({
      data: {
        reference,
        status: QuotationStatus.COMPLETED,
        branchId,
        customerId: input.customerId ?? null,
        assignedToId,
        title: input.header.title,
        quotationDate: input.header.date,
        location: input.header.location,
        partyName: input.header.partyName,
        brand: input.header.brand,
        basicRateLabel: input.header.basicRateLabel,
        diaDiffLabel: input.header.diaDiffLabel,
        payment: input.header.payment,
        vehicleNo: input.header.vehicleNo,
        remarks: input.remarks,
        grandTotal: new Prisma.Decimal(totals.grandTotal),
        totalQuantity: new Prisma.Decimal(totals.totalQuantity),
        createdById: subject.id,
        updatedById: subject.id,
        rows: { create: rowsToCreate(input) },
      },
      include: QUOTATION_INCLUDE,
    });

    const receiptSerial = await nextSequenceValue(branchId, "RECEIPT", year, tx);
    const receiptReference = formatReference(branch.code, "RECEIPT", year, receiptSerial);
    
    await tx.cashLedgerEntry.create({
      data: {
        reference: receiptReference,
        entryDate: new Date(input.header.date),
        branchId,
        customerId: input.customerId ?? null,
        quotationId: q.id,
        partyType: "CUSTOMER",
        partyName: input.header.partyName,
        direction: LedgerDirection.CREDIT,
        amount: new Prisma.Decimal(totals.grandTotal),
        paymentMethod: "CASH",
        particular: `Auto-generated receipt for Quotation ${reference}`,
        status: LedgerStatus.RECEIVED,
        createdById: subject.id,
        updatedById: subject.id,
        approvedById: subject.id,
        approvedAt: new Date(),
      }
    });

    return q;
  });

  await recordAudit({
    action: AuditAction.CREATE,
    entity: "Quotation",
    entityId: created.id,
    summary: `Created quotation ${created.reference} for ${created.partyName}`,
    userId: subject.id,
    branchId,
    newValue: { reference: created.reference, grandTotal: totals.grandTotal },
  });

  if (created.status === QuotationStatus.PENDING_APPROVAL) {
    await notifyApprovers(created);
  }

  return toDomainQuotation(created);
}

export interface UpdateQuotationInput extends QuotationDraftInput {
  readonly customerId?: string | null;
  readonly assignedToId?: string | null;
}

export async function updateQuotation(
  subject: ScopeSubject,
  id: string,
  input: UpdateQuotationInput,
): Promise<Quotation> {
  const existing = await requireQuotation(subject, id);
  assertMutable(subject, existing);


  if (existing.status === QuotationStatus.CANCELLED) {
    throw new BusinessRuleError("This quotation has been cancelled.");
  }

  await assertCustomerInBranch(input.customerId, existing.branchId);

  const totals = await computeTotals(input, existing.branchId);

  const updated = await prisma.$transaction(async (tx) => {
    // Rows are replaced wholesale: sizes can be added, removed or reordered,
    // and a positional diff would be more fragile than a clean rewrite.
    await tx.quotationRow.deleteMany({ where: { quotationId: id } });

    const q = await tx.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.COMPLETED,
        customerId: input.customerId ?? existing.customerId,
        assignedToId:
          subject.role === Role.MANAGER
            ? existing.assignedToId
            : (input.assignedToId ?? existing.assignedToId),
        title: input.header.title,
        quotationDate: input.header.date,
        location: input.header.location,
        partyName: input.header.partyName,
        brand: input.header.brand,
        basicRateLabel: input.header.basicRateLabel,
        diaDiffLabel: input.header.diaDiffLabel,
        payment: input.header.payment,
        vehicleNo: input.header.vehicleNo,
        remarks: input.remarks,
        grandTotal: new Prisma.Decimal(totals.grandTotal),
        totalQuantity: new Prisma.Decimal(totals.totalQuantity),
        updatedById: subject.id,
        rejectionReason: null,
        rows: { create: rowsToCreate(input) },
      },
      include: QUOTATION_INCLUDE,
    });

    await tx.cashLedgerEntry.updateMany({
      where: { quotationId: id, direction: LedgerDirection.CREDIT, deletedAt: null },
      data: {
        amount: q.grandTotal,
        entryDate: new Date(q.quotationDate),
        partyName: q.partyName,
      }
    });

    return q;
  });

  await recordAudit({
    action: AuditAction.UPDATE,
    entity: "Quotation",
    entityId: id,
    summary: `Updated quotation ${updated.reference}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: {
      status: existing.status,
      grandTotal: Number(existing.grandTotal),
      partyName: existing.partyName,
    },
    newValue: {
      status: updated.status,
      grandTotal: totals.grandTotal,
      partyName: updated.partyName,
    },
  });

  if (
    updated.status === QuotationStatus.PENDING_APPROVAL &&
    existing.status !== QuotationStatus.PENDING_APPROVAL
  ) {
    await notifyApprovers(updated);
  }

  return toDomainQuotation(updated);
}

/** Approve, reject, cancel or complete. */
export async function transitionQuotation(
  subject: ScopeSubject,
  id: string,
  target: QuotationStatus,
  reason?: string,
): Promise<Quotation> {
  const existing = await requireQuotation(subject, id);

  const needsApprovalRight =
    target === QuotationStatus.APPROVED ||
    target === QuotationStatus.REJECTED ||
    target === QuotationStatus.COMPLETED;

  if (needsApprovalRight && !hasPermission(subject, PERMISSIONS.QUOTATION_APPROVE)) {
    throw new ForbiddenError("You do not have permission to approve quotations.");
  }
  if (target === QuotationStatus.CANCELLED) {
    assertMutable(subject, existing);
  }

  assertTransitionAllowed(existing.status, target);

  if (target === QuotationStatus.REJECTED && !reason?.trim()) {
    throw new BusinessRuleError("Give a reason when rejecting a quotation.");
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      status: target,
      updatedById: subject.id,
      approvedById:
        target === QuotationStatus.APPROVED ? subject.id : existing.approvedById,
      approvedAt:
        target === QuotationStatus.APPROVED ? new Date() : existing.approvedAt,
      rejectionReason:
        target === QuotationStatus.REJECTED ? (reason ?? null) : null,
    },
    include: QUOTATION_INCLUDE,
  });

  await recordAudit({
    action: auditActionForStatus(target),
    entity: "Quotation",
    entityId: id,
    summary: `${pastTense(target)} quotation ${updated.reference}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { status: existing.status },
    newValue: { status: target, reason: reason ?? null },
  });

  const owners = [existing.assignedToId, existing.createdById].filter(
    (value): value is string => Boolean(value) && value !== subject.id,
  );

  if (target === QuotationStatus.APPROVED) {
    await notifyUsers(owners, {
      type: NotificationType.QUOTATION_APPROVED,
      title: "Quotation approved",
      body: `${updated.reference} for ${updated.partyName} was approved.`,
      link: `/quotations/${id}`,
      branchId: existing.branchId,
    });
  } else if (target === QuotationStatus.REJECTED) {
    await notifyUsers(owners, {
      type: NotificationType.QUOTATION_REJECTED,
      title: "Quotation rejected",
      body: `${updated.reference} was rejected: ${reason}`,
      link: `/quotations/${id}`,
      branchId: existing.branchId,
    });
  }

  return toDomainQuotation(updated);
}

export async function duplicateQuotation(
  subject: ScopeSubject,
  id: string,
): Promise<Quotation> {
  const source = await requireQuotation(subject, id);

  return createQuotation(subject, {
    status: QuotationStatus.DRAFT,
    header: {
      title: source.title,
      date: new Date().toISOString().slice(0, 10),
      location: source.location,
      partyName: source.partyName,
      brand: source.brand,
      basicRateLabel: source.basicRateLabel,
      diaDiffLabel: source.diaDiffLabel,
      payment: source.payment,
      vehicleNo: "",
    },
    rows: source.rows.map((row) => ({
      id: row.id,
      size: row.size,
      quantity: Number(row.quantity),
      basic: Number(row.basic),
      difference: Number(row.difference),
      loading: Number(row.loading),
      discountPercent: Number(row.discountPercent),
      gstPercent: Number(row.gstPercent),
      highlight: row.highlight,
    })),
    remarks: source.remarks,
    branchId: source.branchId,
    customerId: source.customerId,
  });
}

/** Soft delete. Nothing is ever physically removed. */
export async function deleteQuotation(
  subject: ScopeSubject,
  id: string,
): Promise<void> {
  const existing = await requireQuotation(subject, id);

  if (!hasPermission(subject, PERMISSIONS.QUOTATION_DELETE)) {
    throw new ForbiddenError("You do not have permission to delete quotations.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: subject.id },
    });

    await tx.cashLedgerEntry.updateMany({
      where: { quotationId: id, direction: LedgerDirection.CREDIT, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: subject.id },
    });
  });

  await recordAudit({
    action: AuditAction.DELETE,
    entity: "Quotation",
    entityId: id,
    summary: `Deleted quotation ${existing.reference}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { reference: existing.reference, status: existing.status },
  });
}

export async function updateQuotationStatus(
  subject: ScopeSubject,
  id: string,
  status: QuotationStatus,
): Promise<Quotation> {
  const existing = await requireQuotation(subject, id);

  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      status,
      approvedById: status === QuotationStatus.APPROVED ? subject.id : existing.approvedById,
      approvedAt: status === QuotationStatus.APPROVED ? new Date() : existing.approvedAt,
    },
    include: QUOTATION_INCLUDE,
  });

  await recordAudit({
    action: AuditAction.UPDATE,
    entity: "Quotation",
    entityId: id,
    summary: `Changed status of quotation ${updated.reference} to ${status}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { status: existing.status },
    newValue: { status },
  });

  return toDomainQuotation(updated);
}

/* ----------------------------- internals ------------------------------- */

function assertMutable(subject: ScopeSubject, record: QuotationRecord): void {
  const allowed = canMutateRecord(quotationScope(subject), {
    branchId: record.branchId,
    ownerIds: [record.assignedToId, record.createdById],
  });
  if (!allowed) {
    throw new ForbiddenError("You can only change your own quotations.");
  }
}

/** Legal state moves. Anything absent here is rejected. */
const TRANSITIONS: Record<QuotationStatus, readonly QuotationStatus[]> = {
  DRAFT: [QuotationStatus.PENDING_APPROVAL, QuotationStatus.CANCELLED],
  PENDING_APPROVAL: [
    QuotationStatus.APPROVED,
    QuotationStatus.REJECTED,
    QuotationStatus.CANCELLED,
  ],
  REJECTED: [QuotationStatus.PENDING_APPROVAL, QuotationStatus.CANCELLED],
  APPROVED: [QuotationStatus.COMPLETED, QuotationStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

function assertTransitionAllowed(
  from: QuotationStatus,
  to: QuotationStatus,
): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new BusinessRuleError(
      `A ${from.toLowerCase().replace(/_/g, " ")} quotation cannot become ${to
        .toLowerCase()
        .replace(/_/g, " ")}.`,
    );
  }
}

async function assertCustomerInBranch(
  customerId: string | null | undefined,
  branchId: string,
): Promise<void> {
  if (!customerId) return;
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, branchId, ...NOT_DELETED },
    select: { id: true },
  });
  // Guards against a forged customerId pointing at another branch's record.
  if (!customer) {
    throw new BusinessRuleError("That customer does not belong to this branch.");
  }
}

async function notifyApprovers(record: QuotationRecord): Promise<void> {
  await notifyBranchAdmins(record.branchId, {
    type: NotificationType.QUOTATION_APPROVAL_REQUIRED,
    title: "Quotation awaiting approval",
    body: `${record.reference} for ${record.partyName} needs review.`,
    link: `/quotations/${record.id}`,
  });
}

const auditActionForStatus = (status: QuotationStatus): AuditAction => {
  switch (status) {
    case QuotationStatus.APPROVED:
      return AuditAction.APPROVE;
    case QuotationStatus.REJECTED:
      return AuditAction.REJECT;
    case QuotationStatus.CANCELLED:
      return AuditAction.CANCEL;
    default:
      return AuditAction.UPDATE;
  }
};

const pastTense = (status: QuotationStatus): string => {
  switch (status) {
    case QuotationStatus.APPROVED:
      return "Approved";
    case QuotationStatus.REJECTED:
      return "Rejected";
    case QuotationStatus.CANCELLED:
      return "Cancelled";
    case QuotationStatus.COMPLETED:
      return "Completed";
    case QuotationStatus.PENDING_APPROVAL:
      return "Submitted";
    default:
      return "Updated";
  }
};
