import "server-only";
import { NotificationType, Role, UserStatus } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";

/**
 * In-app notifications.
 *
 * Recipients are resolved by *role and branch* rather than by explicit user
 * lists, so a newly created branch admin starts receiving the right alerts
 * without anyone maintaining a subscription table.
 *
 * Delivery is best-effort for the same reason as the audit trail: failing to
 * notify must not fail the operation that triggered it.
 */

interface NotifyInput {
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly link?: string;
  readonly branchId?: string | null;
  readonly recipientIds: readonly string[];
}

async function deliver(input: NotifyInput): Promise<void> {
  const recipients = [...new Set(input.recipientIds)].filter(Boolean);
  if (recipients.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: recipients.map((recipientId) => ({
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        branchId: input.branchId ?? null,
        recipientId,
      })),
    });
  } catch (error) {
    console.error("[notifications] delivery failed", input.type, error);
  }
}

/** Active user ids for a role, optionally within one branch. */
async function userIdsFor(
  role: Role,
  branchId?: string | null,
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      role,
      status: UserStatus.ACTIVE,
      ...NOT_DELETED,
      ...(branchId ? { branchId } : {}),
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

/** Notify the admins of a branch, plus every Super Admin. */
export async function notifyBranchAdmins(
  branchId: string,
  input: Omit<NotifyInput, "recipientIds" | "branchId">,
): Promise<void> {
  const [admins, superAdmins] = await Promise.all([
    userIdsFor(Role.BRANCH_ADMIN, branchId),
    userIdsFor(Role.SUPER_ADMIN),
  ]);
  await deliver({ ...input, branchId, recipientIds: [...admins, ...superAdmins] });
}

/** Notify every Super Admin. Used for org-level events. */
export async function notifySuperAdmins(
  input: Omit<NotifyInput, "recipientIds">,
): Promise<void> {
  await deliver({ ...input, recipientIds: await userIdsFor(Role.SUPER_ADMIN) });
}

/** Notify specific users, e.g. the manager whose quotation was approved. */
export async function notifyUsers(
  recipientIds: readonly string[],
  input: Omit<NotifyInput, "recipientIds">,
): Promise<void> {
  await deliver({ ...input, recipientIds });
}

export async function markNotificationRead(
  notificationId: string,
  recipientId: string,
): Promise<void> {
  // Scoped by recipient so one user cannot dismiss another's notifications.
  await prisma.notification.updateMany({
    where: { id: notificationId, recipientId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(
  recipientId: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { recipientId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function listNotifications(recipientId: string, take = 30) {
  return prisma.notification.findMany({
    where: { recipientId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function countUnread(recipientId: string): Promise<number> {
  return prisma.notification.count({ where: { recipientId, readAt: null } });
}
