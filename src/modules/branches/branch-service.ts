import "server-only";
import { AuditAction, BranchStatus, NotificationType, Role } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import { recordAudit, diffFields } from "@/modules/audit/audit-service";
import { notifySuperAdmins } from "@/modules/notifications/notification-service";
import {
  BusinessRuleError,
  RecordNotFoundError,
} from "@/modules/shared/action-result";
import { ForbiddenError, type ScopeSubject } from "@/modules/permissions/scope";
import type { BranchInput } from "./branch-schema";

/**
 * Branch management.
 *
 * Branches are the tenancy boundary, so only Super Admin may create or archive
 * them. A branch admin can read and edit the details of their own branch but
 * can never enumerate others — the list is scoped, not filtered client-side.
 */

export interface BranchSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly state: string;
  readonly gstNumber: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly status: BranchStatus;
  readonly userCount: number;
  readonly quotationCount: number;
  readonly createdAt: string;
}

/** Branches visible to the subject. Non-super users see only their own. */
export async function listBranches(
  subject: ScopeSubject,
  options: { readonly includeArchived?: boolean } = {},
): Promise<BranchSummary[]> {
  const branches = await prisma.branch.findMany({
    where: {
      ...NOT_DELETED,
      ...(subject.role === Role.SUPER_ADMIN
        ? {}
        : { id: subject.branchId ?? "__none__" }),
      ...(options.includeArchived
        ? {}
        : { status: { not: BranchStatus.ARCHIVED } }),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          users: { where: NOT_DELETED },
          quotations: { where: NOT_DELETED },
        },
      },
    },
  });

  return branches.map((branch) => ({
    id: branch.id,
    code: branch.code,
    name: branch.name,
    state: branch.state,
    gstNumber: branch.gstNumber,
    phone: branch.phone,
    email: branch.email,
    address: branch.address,
    status: branch.status,
    userCount: branch._count.users,
    quotationCount: branch._count.quotations,
    createdAt: branch.createdAt.toISOString(),
  }));
}

/** Active branches, for pickers. */
export async function listSelectableBranches(subject: ScopeSubject) {
  return prisma.branch.findMany({
    where: {
      ...NOT_DELETED,
      status: BranchStatus.ACTIVE,
      ...(subject.role === Role.SUPER_ADMIN
        ? {}
        : { id: subject.branchId ?? "__none__" }),
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

export async function getBranch(subject: ScopeSubject, id: string) {
  if (subject.role !== Role.SUPER_ADMIN && subject.branchId !== id) {
    throw new ForbiddenError("You do not have access to that branch.");
  }
  const branch = await prisma.branch.findFirst({
    where: { id, ...NOT_DELETED },
  });
  if (!branch) throw new RecordNotFoundError("Branch");
  return branch;
}

export async function createBranch(
  subject: ScopeSubject,
  input: BranchInput,
): Promise<{ id: string }> {
  if (subject.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only a Super Admin can create branches.");
  }

  const branch = await prisma.branch.create({
    data: {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      state: input.state.trim(),
      gstNumber: input.gstNumber?.trim() || null,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      logoUrl: input.logoUrl?.trim() || null,
      status: input.status,
      createdById: subject.id,
      updatedById: subject.id,
    },
  });

  await recordAudit({
    action: AuditAction.CREATE,
    entity: "Branch",
    entityId: branch.id,
    summary: `Created branch ${branch.name} (${branch.code})`,
    userId: subject.id,
    branchId: branch.id,
    newValue: { code: branch.code, name: branch.name, state: branch.state },
  });

  await notifySuperAdmins({
    type: NotificationType.BRANCH_CREATED,
    title: "New branch created",
    body: `${branch.name} (${branch.code}) was added to the organisation.`,
    link: `/admin/branches/${branch.id}`,
    branchId: branch.id,
  });

  return { id: branch.id };
}

export async function updateBranch(
  subject: ScopeSubject,
  id: string,
  input: BranchInput,
): Promise<{ id: string }> {
  const existing = await getBranch(subject, id);

  // Only Super Admin may change the code (it is embedded in every reference
  // already issued) or the lifecycle status.
  const isSuper = subject.role === Role.SUPER_ADMIN;
  if (!isSuper && input.code.trim().toUpperCase() !== existing.code) {
    throw new ForbiddenError("Only a Super Admin can change a branch code.");
  }
  if (!isSuper && input.status !== existing.status) {
    throw new ForbiddenError("Only a Super Admin can change a branch status.");
  }

  const data = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    state: input.state.trim(),
    gstNumber: input.gstNumber?.trim() || null,
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    logoUrl: input.logoUrl?.trim() || null,
    status: input.status,
  };

  await prisma.branch.update({
    where: { id },
    data: { ...data, updatedById: subject.id },
  });

  const changes = diffFields(existing as unknown as Record<string, unknown>, data);
  if (changes) {
    await recordAudit({
      action: AuditAction.UPDATE,
      entity: "Branch",
      entityId: id,
      summary: `Updated branch ${data.name}`,
      userId: subject.id,
      branchId: id,
      oldValue: changes.before,
      newValue: changes.after,
    });
  }

  return { id };
}

/**
 * Archive a branch.
 *
 * Archiving, not deleting: quotations, ledger entries and audit rows reference
 * the branch and must remain readable. Archived branches stop accepting new
 * documents and their users are disabled.
 */
export async function archiveBranch(
  subject: ScopeSubject,
  id: string,
): Promise<void> {
  if (subject.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only a Super Admin can archive branches.");
  }

  const branch = await prisma.branch.findFirst({
    where: { id, ...NOT_DELETED },
  });
  if (!branch) throw new RecordNotFoundError("Branch");
  if (branch.status === BranchStatus.ARCHIVED) {
    throw new BusinessRuleError("That branch is already archived.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.branch.update({
      where: { id },
      data: { status: BranchStatus.ARCHIVED, updatedById: subject.id },
    });
    await tx.user.updateMany({
      where: { branchId: id, ...NOT_DELETED },
      data: { status: "DISABLED", updatedById: subject.id },
    });
    // Live sessions must not outlive the branch.
    await tx.session.updateMany({
      where: { user: { branchId: id }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  await recordAudit({
    action: AuditAction.DELETE,
    entity: "Branch",
    entityId: id,
    summary: `Archived branch ${branch.name} (${branch.code})`,
    userId: subject.id,
    branchId: id,
    oldValue: { status: branch.status },
    newValue: { status: BranchStatus.ARCHIVED },
  });
}
