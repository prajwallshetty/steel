"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuditAction, UserStatus } from "@prisma/client";
import { prisma, NOT_DELETED } from "@/lib/database/prisma";
import { recordAudit } from "@/modules/audit/audit-service";
import {
  actionError,
  actionOk,
  runAction,
  type ActionResult,
} from "@/modules/shared/action-result";
import {
  changeOwnPasswordSchema,
  loginSchema,
} from "@/modules/users/user-schema";
import { hashPassword, verifyPassword } from "./password";
import {
  createSession,
  destroySession,
  getSessionUser,
  revokeAllSessions,
} from "./session";

/**
 * Authentication actions.
 *
 * Failures are reported with one generic message regardless of cause. Saying
 * "no such user" versus "wrong password" turns the login form into a username
 * oracle, which is the first step of a credential-stuffing run.
 */

const GENERIC_FAILURE = "Incorrect username or password.";

export async function loginAction(
  _prev: ActionResult<{ redirectTo: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const parsed = loginSchema.safeParse({
      username: formData.get("username"),
      password: formData.get("password"),
    });
    if (!parsed.success) return actionError("Enter your username and password.");

    const username = parsed.data.username.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { username, ...NOT_DELETED },
      include: { branch: { select: { status: true, name: true } } },
    });

    if (!user) {
      // Hash anyway so a missing account and a wrong password take comparable
      // time; a fast rejection would reveal which usernames exist.
      await verifyPassword(parsed.data.password, PLACEHOLDER_HASH);
      return actionError(GENERIC_FAILURE);
    }

    const passwordValid = await verifyPassword(
      parsed.data.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      await recordAudit({
        action: AuditAction.LOGIN_FAILED,
        entity: "User",
        entityId: user.id,
        summary: `Failed sign-in for ${user.username}`,
        userId: user.id,
        branchId: user.branchId,
      });
      return actionError(GENERIC_FAILURE);
    }

    if (user.status !== UserStatus.ACTIVE) {
      return actionError(
        "This account has been disabled. Contact your administrator.",
      );
    }
    if (user.branch && user.branch.status === "ARCHIVED") {
      return actionError(
        `Branch ${user.branch.name} is archived. Contact your administrator.`,
      );
    }

    await createSession(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await recordAudit({
      action: AuditAction.LOGIN,
      entity: "User",
      entityId: user.id,
      summary: `${user.name} signed in`,
      userId: user.id,
      branchId: user.branchId,
    });

    return actionOk({ redirectTo: "/dashboard" });
  });
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  await destroySession();
  if (user) {
    await recordAudit({
      action: AuditAction.LOGOUT,
      entity: "User",
      entityId: user.id,
      summary: `${user.name} signed out`,
      userId: user.id,
      branchId: user.branchId,
    });
  }
  redirect("/login");
}

export async function changeOwnPasswordAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await getSessionUser();
    if (!user) return actionError("Your session has expired. Sign in again.");

    const parsed = changeOwnPasswordSchema.parse(input);

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!record) return actionError("Account not found.");

    const valid = await verifyPassword(parsed.currentPassword, record.passwordHash);
    if (!valid) {
      return actionError("Your current password is incorrect.", {
        currentPassword: "Incorrect password",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.password) },
    });

    // Every other device holding the old credential is logged out; the current
    // session is re-established so the user is not booted out of their own
    // password change.
    await revokeAllSessions(user.id);
    await createSession(user.id);

    await recordAudit({
      action: AuditAction.PASSWORD_RESET,
      entity: "User",
      entityId: user.id,
      summary: `${user.name} changed their own password`,
      userId: user.id,
      branchId: user.branchId,
    });

    return actionOk({ id: user.id });
  });
}

/** Used only to equalise timing on unknown usernames. Matches no password. */
const PLACEHOLDER_HASH =
  "$2a$12$C6UzMDM.H6dfI/f/IKcEe.HCFbNsvQGRWnEjoLbBoRUcqYcqfVvGm";

/** Convenience for `headers()` in actions that need the caller's address. */
export async function requestHeaders(): Promise<Headers> {
  return headers();
}
