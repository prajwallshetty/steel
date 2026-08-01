"use server";

import { revalidatePath } from "next/cache";
import { QuotationStatus } from "@prisma/client";
import { z } from "zod";
import { authorizeAction } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import {
  actionOk,
  runAction,
  type ActionResult,
} from "@/modules/shared/action-result";
import { quotationDraftSchema } from "@/lib/validation/quotation-schema";
import {
  createQuotation,
  deleteQuotation,
  duplicateQuotation,
  transitionQuotation,
  updateQuotation,
} from "./quotation-service";

/**
 * Quotation server actions.
 *
 * Each one authorises, re-validates its payload with the same schema the form
 * uses, then delegates to the service. A server action is a public HTTP
 * endpoint: client-side validation is a convenience, never the enforcement
 * point, and the permission check here is what actually gates the write.
 */

const saveSchema = quotationDraftSchema.extend({
  branchId: z.string().trim().optional().nullable(),
  customerId: z.string().trim().optional().nullable(),
  assignedToId: z.string().trim().optional().nullable(),
});

function revalidateQuotation(id?: string): void {
  revalidatePath("/quotations");
  revalidatePath("/dashboard");
  if (id) {
    revalidatePath(`/quotations/${id}`);
    revalidatePath(`/quotations/${id}/print`);
  }
}

export async function createQuotationAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.QUOTATION_CREATE);
    const parsed = saveSchema.parse(input);
    const created = await createQuotation(user, parsed);
    revalidateQuotation(created.id);
    return actionOk({ id: created.id });
  });
}

export async function updateQuotationAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.QUOTATION_UPDATE_OWN);
    const parsed = saveSchema.parse(input);
    const updated = await updateQuotation(user, id, parsed);
    revalidateQuotation(updated.id);
    return actionOk({ id: updated.id });
  });
}

const transitionSchema = z.object({
  status: z.nativeEnum(QuotationStatus),
  reason: z.string().trim().max(500).optional(),
});

export async function transitionQuotationAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    // The specific right (approve vs. cancel) is checked inside the service,
    // which knows the target state; this only requires a quotation-capable user.
    const user = await authorizeAction(PERMISSIONS.QUOTATION_VIEW_OWN);
    const parsed = transitionSchema.parse(input);
    await transitionQuotation(user, id, parsed.status, parsed.reason);
    revalidateQuotation(id);
    return actionOk({ id });
  });
}

export async function duplicateQuotationAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.QUOTATION_CREATE);
    const created = await duplicateQuotation(user, id);
    revalidateQuotation(created.id);
    return actionOk({ id: created.id });
  });
}

export async function deleteQuotationAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.QUOTATION_DELETE);
    await deleteQuotation(user, id);
    revalidateQuotation(id);
    return actionOk({ id });
  });
}
