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
import type { VendorInput } from "./vendor-schema";

export interface VendorSummary {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly gstNumber: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly branchId: string;
  readonly branchName: string;
  readonly createdAt: string;
}

export async function listVendors(
  subject: ScopeSubject,
  filters: { readonly search?: string; readonly branchId?: string } = {},
): Promise<VendorSummary[]> {
  const vendors = await prisma.vendor.findMany({
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
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    phone: vendor.phone,
    email: vendor.email,
    gstNumber: vendor.gstNumber,
    city: vendor.city,
    state: vendor.state,
    branchId: vendor.branchId,
    branchName: vendor.branch.name,
    createdAt: vendor.createdAt.toISOString(),
  }));
}

export async function listSelectableVendors(
  subject: ScopeSubject,
  branchId?: string,
) {
  return prisma.vendor.findMany({
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

export async function getVendor(subject: ScopeSubject, id: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { AND: [{ id }, branchWhere(subject), NOT_DELETED] },
  });
  if (!vendor) throw new RecordNotFoundError("Vendor");
  return vendor;
}

export async function createVendor(
  subject: ScopeSubject,
  input: VendorInput,
): Promise<{ id: string }> {
  const branchId = resolveWriteBranch(subject, input.branchId || null);
  const nameTrimmed = input.name.trim();

  // Check if a vendor with the same name already exists in this branch (active or soft-deleted)
  const existing = await prisma.vendor.findFirst({
    where: {
      branchId,
      name: { equals: nameTrimmed, mode: "insensitive" },
    },
  });

  if (existing) {
    if (existing.deletedAt === null) {
      throw new BusinessRuleError(
        `A vendor named "${nameTrimmed}" already exists in this branch.`,
      );
    }

    // Soft-deleted vendor: restore and update with new information
    const restored = await prisma.vendor.update({
      where: { id: existing.id },
      data: {
        name: nameTrimmed,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        gstNumber: input.gstNumber?.trim().toUpperCase() || null,
        address: input.address?.trim() || null,
        city: input.city?.trim() || null,
        state: input.state?.trim() || null,
        pin: input.pin?.trim() || null,
        deletedAt: null,
        updatedById: subject.id,
      },
    });

    await recordAudit({
      action: AuditAction.RESTORE,
      entity: "Vendor",
      entityId: restored.id,
      summary: `Restored vendor ${restored.name}`,
      userId: subject.id,
      branchId,
      newValue: { name: restored.name, gstNumber: restored.gstNumber },
    });

    return { id: restored.id };
  }

  const vendor = await prisma.vendor.create({
    data: {
      name: nameTrimmed,
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
    entity: "Vendor",
    entityId: vendor.id,
    summary: `Created vendor ${vendor.name}`,
    userId: subject.id,
    branchId,
    newValue: { name: vendor.name, gstNumber: vendor.gstNumber },
  });

  return { id: vendor.id };
}

export async function updateVendor(
  subject: ScopeSubject,
  id: string,
  input: VendorInput,
): Promise<{ id: string }> {
  const existing = await getVendor(subject, id);
  const nameTrimmed = input.name.trim();

  // Check if name collides with another vendor in the same branch
  const duplicate = await prisma.vendor.findFirst({
    where: {
      branchId: existing.branchId,
      name: { equals: nameTrimmed, mode: "insensitive" },
      id: { not: id },
      deletedAt: null,
    },
  });

  if (duplicate) {
    throw new BusinessRuleError(
      `A vendor named "${nameTrimmed}" already exists in this branch.`,
    );
  }

  const data = {
    name: nameTrimmed,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    gstNumber: input.gstNumber?.trim().toUpperCase() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    pin: input.pin?.trim() || null,
  };

  await prisma.vendor.update({
    where: { id },
    data: { ...data, updatedById: subject.id },
  });

  const changes = diffFields(existing as unknown as Record<string, unknown>, data);
  if (changes) {
    await recordAudit({
      action: AuditAction.UPDATE,
      entity: "Vendor",
      entityId: id,
      summary: `Updated vendor ${data.name}`,
      userId: subject.id,
      branchId: existing.branchId,
      oldValue: changes.before,
      newValue: changes.after,
    });
  }

  return { id };
}

export async function deleteVendor(
  subject: ScopeSubject,
  id: string,
): Promise<void> {
  const existing = await getVendor(subject, id);

  // Check references in CashLedgerEntry
  const referenced = await prisma.cashLedgerEntry.count({
    where: { vendorId: id, ...NOT_DELETED },
  });
  if (referenced > 0) {
    throw new BusinessRuleError(
      `${existing.name} is referenced by ${referenced} ledger entry and cannot be removed.`,
    );
  }

  await prisma.vendor.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: subject.id },
  });

  await recordAudit({
    action: AuditAction.DELETE,
    entity: "Vendor",
    entityId: id,
    summary: `Deleted vendor ${existing.name}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { name: existing.name },
  });
}
