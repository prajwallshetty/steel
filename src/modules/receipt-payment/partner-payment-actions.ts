"use server";

import { revalidatePath } from "next/cache";
import { authorizeAction } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import {
  actionOk,
  runAction,
  type ActionResult,
} from "@/modules/shared/action-result";
import { partnerPaymentSchema } from "./receipt-payment-schema";
import {
  createPartnerPayment,
  deletePartnerPayment,
} from "./partner-payment-service";

function revalidate(): void {
  revalidatePath("/customer-payments");
  revalidatePath("/vendor-payments");
  revalidatePath("/ledger");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function createPartnerPaymentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.LEDGER_CREATE);
    const result = await createPartnerPayment(user, partnerPaymentSchema.parse(input));
    revalidate();
    return actionOk(result);
  });
}

export async function deletePartnerPaymentAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.LEDGER_DELETE);
    await deletePartnerPayment(user, id);
    revalidate();
    return actionOk({ id });
  });
}
