"use server";

import { revalidatePath } from "next/cache";
import { authorizeAction } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import {
  actionOk,
  runAction,
  type ActionResult,
} from "@/modules/shared/action-result";
import { branchSchema } from "./branch-schema";
import { archiveBranch, createBranch, updateBranch } from "./branch-service";

export async function createBranchAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.BRANCH_CREATE);
    const result = await createBranch(user, branchSchema.parse(input));
    revalidatePath("/admin/branches");
    revalidatePath("/dashboard");
    return actionOk(result);
  });
}

export async function updateBranchAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.BRANCH_UPDATE);
    const result = await updateBranch(user, id, branchSchema.parse(input));
    revalidatePath("/admin/branches");
    revalidatePath(`/admin/branches/${id}`);
    return actionOk(result);
  });
}

export async function archiveBranchAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.BRANCH_ARCHIVE);
    await archiveBranch(user, id);
    revalidatePath("/admin/branches");
    return actionOk({ id });
  });
}

import { cookies } from "next/headers";
const ACTIVE_BRANCH_COOKIE = "steel_active_branch";

/** Set active branch cookie for Super Admin switcher. */
export async function setActiveBranchCookie(branchId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRANCH_COOKIE, branchId, {
    httpOnly: false, // Accessible to clientJS for quick UI updates
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}
