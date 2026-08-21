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
import type { StaffInput } from "./staff-schema";

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

  await prisma.staff.update({
    where: { id },
    data: { ...data, updatedById: subject.id },
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
