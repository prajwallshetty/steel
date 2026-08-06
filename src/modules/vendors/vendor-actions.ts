"use server";

import { revalidatePath } from "next/cache";
import { authorizeAction } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import {
  actionOk,
  runAction,
  type ActionResult,
} from "@/modules/shared/action-result";
import { vendorSchema } from "./vendor-schema";
import {
  createVendor,
  deleteVendor,
  updateVendor,
} from "./vendor-service";

export async function createVendorAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.CUSTOMER_CREATE);
    const result = await createVendor(user, vendorSchema.parse(input));
    revalidatePath("/vendors");
    return actionOk(result);
  });
}

export async function updateVendorAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.CUSTOMER_UPDATE);
    const result = await updateVendor(user, id, vendorSchema.parse(input));
    revalidatePath("/vendors");
    return actionOk(result);
  });
}

export async function deleteVendorAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.CUSTOMER_DELETE);
    await deleteVendor(user, id);
    revalidatePath("/vendors");
    return actionOk({ id });
  });
}
