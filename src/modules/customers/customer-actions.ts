"use server";

import { revalidatePath } from "next/cache";
import { authorizeAction } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import {
  actionOk,
  runAction,
  type ActionResult,
} from "@/modules/shared/action-result";
import { customerSchema } from "./customer-schema";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "./customer-service";

export async function createCustomerAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.CUSTOMER_CREATE);
    const result = await createCustomer(user, customerSchema.parse(input));
    revalidatePath("/customers");
    revalidatePath("/quotations/new");
    return actionOk(result);
  });
}

export async function updateCustomerAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.CUSTOMER_UPDATE);
    const result = await updateCustomer(user, id, customerSchema.parse(input));
    revalidatePath("/customers");
    return actionOk(result);
  });
}

export async function deleteCustomerAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.CUSTOMER_DELETE);
    await deleteCustomer(user, id);
    revalidatePath("/customers");
    return actionOk({ id });
  });
}
