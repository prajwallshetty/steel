import "server-only";
import { AuditAction } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import { recordAudit, diffFields } from "@/modules/audit/audit-service";
import {
  BusinessRuleError,
  RecordNotFoundError,
} from "@/modules/shared/action-result";
import {
  branchWhere,
  resolveWriteBranch,
  type ScopeSubject,
} from "@/modules/permissions/scope";
import type { CustomerInput } from "./customer-schema";

/**
 * Customers.
 *
 * Scoped to the branch rather than to the creating user: a quotation must be
 * able to reference any customer of its branch, so restricting managers to
 * their own records would make the picker unusable and cause duplicate
 * customer rows for the same trading party.
 */

export interface CustomerSummary {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly gstNumber: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly branchId: string;
  readonly branchName: string;
  readonly quotationCount: number;
  readonly createdAt: string;
}

export async function listCustomers(
  subject: ScopeSubject,
  filters: { readonly search?: string; readonly branchId?: string } = {},
): Promise<CustomerSummary[]> {
  const customers = await prisma.customer.findMany({
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
                { gstNumber: { contains: filters.search.trim(), mode: "insensitive" } },
                { city: { contains: filters.search.trim(), mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    include: {
      branch: { select: { name: true } },
      _count: { select: { quotations: { where: NOT_DELETED } } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    gstNumber: customer.gstNumber,
    city: customer.city,
    state: customer.state,
    branchId: customer.branchId,
    branchName: customer.branch.name,
    quotationCount: customer._count.quotations,
    createdAt: customer.createdAt.toISOString(),
  }));
}

/** Minimal shape for the quotation and ledger pickers. */
export async function listSelectableCustomers(
  subject: ScopeSubject,
  branchId?: string,
) {
  return prisma.customer.findMany({
    where: {
      AND: [
        branchWhere(subject),
        NOT_DELETED,
        branchId ? { branchId } : {},
      ],
    },
    select: { id: true, name: true, gstNumber: true, branchId: true },
    orderBy: { name: "asc" },
  });
}

export async function getCustomer(subject: ScopeSubject, id: string) {
  const customer = await prisma.customer.findFirst({
    where: { AND: [{ id }, branchWhere(subject), NOT_DELETED] },
  });
  if (!customer) throw new RecordNotFoundError("Customer");
  return customer;
}

export async function createCustomer(
  subject: ScopeSubject,
  input: CustomerInput,
): Promise<{ id: string }> {
  const branchId = resolveWriteBranch(subject, input.branchId || null);

  const customer = await prisma.customer.create({
    data: {
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      gstNumber: input.gstNumber?.trim().toUpperCase() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      pin: input.pin?.trim() || null,
      branchId,
      createdById: subject.id,
      updatedById: subject.id,
    },
  });

  await recordAudit({
    action: AuditAction.CREATE,
    entity: "Customer",
    entityId: customer.id,
    summary: `Created customer ${customer.name}`,
    userId: subject.id,
    branchId,
    newValue: { name: customer.name, gstNumber: customer.gstNumber },
  });

  return { id: customer.id };
}

export async function updateCustomer(
  subject: ScopeSubject,
  id: string,
  input: CustomerInput,
): Promise<{ id: string }> {
  const existing = await getCustomer(subject, id);

  const data = {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    gstNumber: input.gstNumber?.trim().toUpperCase() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    pin: input.pin?.trim() || null,
  };

  await prisma.customer.update({
    where: { id },
    data: { ...data, updatedById: subject.id },
  });

  const changes = diffFields(existing as unknown as Record<string, unknown>, data);
  if (changes) {
    await recordAudit({
      action: AuditAction.UPDATE,
      entity: "Customer",
      entityId: id,
      summary: `Updated customer ${data.name}`,
      userId: subject.id,
      branchId: existing.branchId,
      oldValue: changes.before,
      newValue: changes.after,
    });
  }

  return { id };
}

export async function deleteCustomer(
  subject: ScopeSubject,
  id: string,
): Promise<void> {
  const existing = await getCustomer(subject, id);

  const referenced = await prisma.quotation.count({
    where: { customerId: id, ...NOT_DELETED },
  });
  if (referenced > 0) {
    throw new BusinessRuleError(
      `${existing.name} is referenced by ${referenced} quotation${referenced === 1 ? "" : "s"} and cannot be removed.`,
    );
  }

  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: subject.id },
  });

  await recordAudit({
    action: AuditAction.DELETE,
    entity: "Customer",
    entityId: id,
    summary: `Deleted customer ${existing.name}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { name: existing.name },
  });
}
