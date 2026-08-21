"use server";

import { revalidatePath } from "next/cache";
import { authorizeAction } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import {
  actionOk,
  runAction,
  type ActionResult,
} from "@/modules/shared/action-result";
import { staffPaymentSchema, staffSchema } from "./staff-schema";
import {
  createStaff,
  deleteStaff,
  recordStaffTransaction,
  updateStaff,
} from "./staff-service";

export async function createStaffAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.STAFF_CREATE);
    const result = await createStaff(user, staffSchema.parse(input));
    revalidatePath("/staff");
    return actionOk(result);
  });
}

export async function updateStaffAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.STAFF_UPDATE);
    const result = await updateStaff(user, id, staffSchema.parse(input));
    revalidatePath("/staff");
    return actionOk(result);
  });
}

export async function deleteStaffAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.STAFF_DELETE);
    await deleteStaff(user, id);
    revalidatePath("/staff");
    return actionOk({ id });
  });
}

export async function recordStaffTransactionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.STAFF_UPDATE);
    const result = await recordStaffTransaction(user, staffPaymentSchema.parse(input));
    revalidatePath("/staff");
    revalidatePath("/dashboard");
    revalidatePath("/ledger");
    return actionOk(result);
  });
}
