"use server";

import { revalidatePath } from "next/cache";
import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { authorizeAction } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import {
  actionOk,
  runAction,
  type ActionResult,
} from "@/modules/shared/action-result";
import { generateTemporaryPassword } from "@/modules/auth/password";
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
} from "./user-schema";
import {
  createUser,
  deleteUser,
  resetUserPassword,
  setUserPermissions,
  setUserStatus,
  updateUser,
} from "./user-service";

function revalidateUsers(id?: string): void {
  revalidatePath("/admin/users");
  if (id) revalidatePath(`/admin/users/${id}`);
}

export async function createUserAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.USER_CREATE);
    const result = await createUser(user, createUserSchema.parse(input));
    revalidateUsers();
    return actionOk(result);
  });
}

export async function updateUserAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.USER_UPDATE);
    const result = await updateUser(user, id, updateUserSchema.parse(input));
    revalidateUsers(id);
    return actionOk(result);
  });
}

export async function setUserStatusAction(
  id: string,
  status: UserStatus,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.USER_DISABLE);
    await setUserStatus(user, id, z.nativeEnum(UserStatus).parse(status));
    revalidateUsers(id);
    return actionOk({ id });
  });
}

/**
 * Reset a password.
 *
 * When no password is supplied a readable temporary one is generated and
 * returned once, for the administrator to hand over. It is never stored in
 * plaintext and never appears in the audit log.
 */
export async function resetUserPasswordAction(
  id: string,
  input?: unknown,
): Promise<ActionResult<{ id: string; password: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.USER_RESET_PASSWORD);

    const password =
      input === undefined || input === null
        ? generateTemporaryPassword()
        : resetPasswordSchema.parse(input).password;

    await resetUserPassword(user, id, password);
    revalidateUsers(id);
    return actionOk({ id, password });
  });
}

const permissionsSchema = z.object({
  extraPermissions: z.array(z.string()),
  deniedPermissions: z.array(z.string()),
});

export async function setUserPermissionsAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.USER_MANAGE_PERMISSIONS);
    const parsed = permissionsSchema.parse(input);
    await setUserPermissions(
      user,
      id,
      parsed.extraPermissions,
      parsed.deniedPermissions,
    );
    revalidateUsers(id);
    return actionOk({ id });
  });
}

export async function deleteUserAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.USER_UPDATE);
    await deleteUser(user, id);
    revalidateUsers();
    return actionOk({ id });
  });
}
