"use server";

import { revalidatePath } from "next/cache";
import { LedgerStatus } from "@prisma/client";
import { z } from "zod";
import { authorizeAction } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import {
  actionOk,
  runAction,
  type ActionResult,
} from "@/modules/shared/action-result";
import {
  paymentInputSchema,
  receiptInputSchema,
  vendorBillSchema,
} from "./receipt-payment-schema";
import {
  createPayment,
  deletePayment,
  createVendorBill,
} from "./payment-service";
import {
  createReceipt,
  deleteReceipt,
} from "./receipt-service";

function revalidate(): void {
  revalidatePath("/payments");
  revalidatePath("/receipts");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function createPaymentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.LEDGER_CREATE);
    const result = await createPayment(user, paymentInputSchema.parse(input));
    revalidate();
    return actionOk(result);
  });
}

export async function deletePaymentAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.LEDGER_DELETE);
    await deletePayment(user, id);
    revalidate();
    return actionOk({ id });
  });
}

export async function createReceiptAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.LEDGER_CREATE);
    const result = await createReceipt(user, receiptInputSchema.parse(input));
    revalidate();
    return actionOk(result);
  });
}

export async function deleteReceiptAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.LEDGER_DELETE);
    await deleteReceipt(user, id);
    revalidate();
    return actionOk({ id });
  });
}

export async function createVendorBillAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.LEDGER_CREATE);
    const result = await createVendorBill(user, vendorBillSchema.parse(input));
    revalidate();
    return actionOk(result);
  });
}
