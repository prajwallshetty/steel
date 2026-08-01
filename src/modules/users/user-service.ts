import "server-only";
import { AuditAction, NotificationType, Role, UserStatus } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import { hashPassword } from "@/modules/auth/password";
import { revokeAllSessions } from "@/modules/auth/session";
import { recordAudit, diffFields } from "@/modules/audit/audit-service";
import { notifyUsers } from "@/modules/notifications/notification-service";
import {
  BusinessRuleError,
  RecordNotFoundError,
} from "@/modules/shared/action-result";
import { ForbiddenError, type ScopeSubject } from "@/modules/permissions/scope";
import type { CreateUserInput, UpdateUserInput } from "./user-schema";

/**
 * User management.
 *
 * Two rules do the heavy lifting and are enforced on every path:
 *   1. A branch admin may only touch users inside their own branch.
 *   2. Nobody may create or modify a user with more authority than themselves.
 *
 * Without (2), a branch admin could mint a Super Admin and escalate out of
 * their own tenancy in one step.
 */

/** Lower number is more authority. Used for the escalation check. */
const ROLE_RANK: Record<Role, number> = {
  SUPER_ADMIN: 0,
  BRANCH_ADMIN: 1,
  MANAGER: 2,
};

function assertMayAssignRole(subject: ScopeSubject, target: Role): void {
  if (subject.role === Role.SUPER_ADMIN) return;
  if (ROLE_RANK[target] <= ROLE_RANK[subject.role]) {
    throw new ForbiddenError(
      "You cannot create or modify a user at or above your own role.",
    );
  }
}

async function requireManageableUser(subject: ScopeSubject, id: string) {
  const user = await prisma.user.findFirst({
    where: { id, ...NOT_DELETED },
    include: { branch: { select: { id: true, name: true } } },
  });
  if (!user) throw new RecordNotFoundError("User");

  if (subject.role !== Role.SUPER_ADMIN) {
    if (!subject.branchId || user.branchId !== subject.branchId) {
      throw new ForbiddenError("That user is not in your branch.");
    }
    assertMayAssignRole(subject, user.role);
  }
  return user;
}

export interface UserSummary {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly role: Role;
  readonly status: UserStatus;
  readonly branchId: string | null;
  readonly branchName: string | null;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export async function listUsers(
  subject: ScopeSubject,
  filters: { readonly search?: string; readonly branchId?: string } = {},
): Promise<UserSummary[]> {
  const scopeFilter =
    subject.role === Role.SUPER_ADMIN
      ? filters.branchId
        ? { branchId: filters.branchId }
        : {}
      : { branchId: subject.branchId ?? "__none__" };

  const users = await prisma.user.findMany({
    where: {
      ...NOT_DELETED,
      ...scopeFilter,
      ...(filters.search?.trim()
        ? {
            OR: [
              { name: { contains: filters.search.trim(), mode: "insensitive" as const } },
              { username: { contains: filters.search.trim(), mode: "insensitive" as const } },
              { email: { contains: filters.search.trim(), mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: { branch: { select: { name: true } } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    branchId: user.branchId,
    branchName: user.branch?.name ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }));
}

/** Managers of a branch, for the quotation assignment picker. */
export async function listAssignableUsers(subject: ScopeSubject, branchId: string) {
  if (subject.role !== Role.SUPER_ADMIN && subject.branchId !== branchId) {
    throw new ForbiddenError("You do not have access to that branch.");
  }
  return prisma.user.findMany({
    where: {
      branchId,
      status: UserStatus.ACTIVE,
      ...NOT_DELETED,
      role: { in: [Role.MANAGER, Role.BRANCH_ADMIN] },
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function getUser(subject: ScopeSubject, id: string) {
  return requireManageableUser(subject, id);
}

export async function createUser(
  subject: ScopeSubject,
  input: CreateUserInput,
): Promise<{ id: string }> {
  assertMayAssignRole(subject, input.role);

  const branchId = input.role === Role.SUPER_ADMIN ? null : (input.branchId ?? null);

  if (subject.role !== Role.SUPER_ADMIN) {
    if (!branchId || branchId !== subject.branchId) {
      throw new ForbiddenError("You can only create users in your own branch.");
    }
  }
  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, ...NOT_DELETED },
      select: { id: true, status: true, name: true },
    });
    if (!branch) throw new RecordNotFoundError("Branch");
    if (branch.status === "ARCHIVED") {
      throw new BusinessRuleError(`Branch ${branch.name} is archived.`);
    }
  }

  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      username: input.username.trim().toLowerCase(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      status: input.status,
      branchId,
      createdById: subject.id,
      updatedById: subject.id,
    },
  });

  await recordAudit({
    action: AuditAction.CREATE,
    entity: "User",
    entityId: user.id,
    summary: `Created ${user.role.replace(/_/g, " ").toLowerCase()} ${user.name}`,
    userId: subject.id,
    branchId,
    newValue: { username: user.username, role: user.role, branchId },
  });

  await notifyUsers([user.id], {
    type: NotificationType.USER_CREATED,
    title: "Welcome to Steel ERP",
    body: `Your ${user.role.replace(/_/g, " ").toLowerCase()} account has been created.`,
    link: "/dashboard",
    branchId,
  });

  return { id: user.id };
}

export async function updateUser(
  subject: ScopeSubject,
  id: string,
  input: UpdateUserInput,
): Promise<{ id: string }> {
  const existing = await requireManageableUser(subject, id);
  assertMayAssignRole(subject, input.role);

  const branchId = input.role === Role.SUPER_ADMIN ? null : (input.branchId ?? null);

  if (subject.role !== Role.SUPER_ADMIN && branchId !== subject.branchId) {
    throw new ForbiddenError("You cannot move a user to another branch.");
  }
  // Removing your own access mid-session is almost always a mistake, and it
  // can strand the organisation with no reachable administrator.
  if (existing.id === subject.id) {
    if (input.role !== existing.role) {
      throw new BusinessRuleError("You cannot change your own role.");
    }
    if (input.status !== UserStatus.ACTIVE) {
      throw new BusinessRuleError("You cannot disable your own account.");
    }
  }

  await assertNotLastSuperAdmin(existing.id, existing.role, input.role, input.status);

  const data = {
    name: input.name.trim(),
    username: input.username.trim().toLowerCase(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    role: input.role,
    status: input.status,
    branchId,
  };

  await prisma.user.update({
    where: { id },
    data: { ...data, updatedById: subject.id },
  });

  // A disabled or re-scoped user must not keep an authenticated session.
  if (
    data.status === UserStatus.DISABLED ||
    data.role !== existing.role ||
    data.branchId !== existing.branchId
  ) {
    await revokeAllSessions(id);
  }

  const changes = diffFields(existing as unknown as Record<string, unknown>, data);
  if (changes) {
    await recordAudit({
      action: AuditAction.UPDATE,
      entity: "User",
      entityId: id,
      summary: `Updated user ${data.name}`,
      userId: subject.id,
      branchId,
      oldValue: changes.before,
      newValue: changes.after,
    });
  }

  return { id };
}

export async function setUserStatus(
  subject: ScopeSubject,
  id: string,
  status: UserStatus,
): Promise<void> {
  const existing = await requireManageableUser(subject, id);
  if (existing.id === subject.id) {
    throw new BusinessRuleError("You cannot disable your own account.");
  }
  await assertNotLastSuperAdmin(existing.id, existing.role, existing.role, status);

  await prisma.user.update({
    where: { id },
    data: { status, updatedById: subject.id },
  });
  if (status === UserStatus.DISABLED) await revokeAllSessions(id);

  await recordAudit({
    action: AuditAction.UPDATE,
    entity: "User",
    entityId: id,
    summary: `${status === UserStatus.ACTIVE ? "Enabled" : "Disabled"} user ${existing.name}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { status: existing.status },
    newValue: { status },
  });
}

export async function resetUserPassword(
  subject: ScopeSubject,
  id: string,
  password: string,
): Promise<void> {
  const existing = await requireManageableUser(subject, id);

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), updatedById: subject.id },
  });
  // Whoever held the old password must be logged out.
  await revokeAllSessions(id);

  await recordAudit({
    action: AuditAction.PASSWORD_RESET,
    entity: "User",
    entityId: id,
    summary: `Reset password for ${existing.name}`,
    userId: subject.id,
    branchId: existing.branchId,
  });
}

export async function setUserPermissions(
  subject: ScopeSubject,
  id: string,
  extraPermissions: readonly string[],
  deniedPermissions: readonly string[],
): Promise<void> {
  if (subject.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only a Super Admin can change permissions.");
  }
  const existing = await requireManageableUser(subject, id);

  await prisma.user.update({
    where: { id },
    data: {
      extraPermissions: [...extraPermissions],
      deniedPermissions: [...deniedPermissions],
      updatedById: subject.id,
    },
  });

  await recordAudit({
    action: AuditAction.PERMISSION_CHANGE,
    entity: "User",
    entityId: id,
    summary: `Changed permissions for ${existing.name}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: {
      extraPermissions: existing.extraPermissions,
      deniedPermissions: existing.deniedPermissions,
    },
    newValue: { extraPermissions, deniedPermissions },
  });
}

export async function deleteUser(subject: ScopeSubject, id: string): Promise<void> {
  const existing = await requireManageableUser(subject, id);
  if (existing.id === subject.id) {
    throw new BusinessRuleError("You cannot delete your own account.");
  }
  await assertNotLastSuperAdmin(
    existing.id,
    existing.role,
    existing.role,
    UserStatus.DISABLED,
  );

  await prisma.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: UserStatus.DISABLED,
      updatedById: subject.id,
      // Free the unique handles so they can be reused by a new account.
      username: `${existing.username}+deleted-${Date.now()}`,
      email: existing.email ? `${existing.email}+deleted-${Date.now()}` : null,
    },
  });
  await revokeAllSessions(id);

  await recordAudit({
    action: AuditAction.DELETE,
    entity: "User",
    entityId: id,
    summary: `Deleted user ${existing.name}`,
    userId: subject.id,
    branchId: existing.branchId,
    oldValue: { username: existing.username, role: existing.role },
  });
}

/**
 * Refuse any change that would leave the system with no active Super Admin.
 * Without this the organisation can be locked out permanently, with no
 * in-application way back in.
 */
async function assertNotLastSuperAdmin(
  userId: string,
  currentRole: Role,
  nextRole: Role,
  nextStatus: UserStatus,
): Promise<void> {
  if (currentRole !== Role.SUPER_ADMIN) return;
  const staysActiveSuper =
    nextRole === Role.SUPER_ADMIN && nextStatus === UserStatus.ACTIVE;
  if (staysActiveSuper) return;

  const remaining = await prisma.user.count({
    where: {
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      ...NOT_DELETED,
      id: { not: userId },
    },
  });
  if (remaining === 0) {
    throw new BusinessRuleError(
      "This is the last active Super Admin. Promote another account first.",
    );
  }
}
