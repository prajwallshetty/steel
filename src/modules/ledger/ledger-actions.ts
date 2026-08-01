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
import { ledgerEntrySchema } from "./ledger-schema";
import {
  createLedgerEntry,
  deleteLedgerEntry,
  setLedgerStatus,
  updateLedgerEntry,
} from "./ledger-service";

function revalidateLedger(): void {
  revalidatePath("/ledger");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function createLedgerEntryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.LEDGER_CREATE);
    const result = await createLedgerEntry(user, ledgerEntrySchema.parse(input));
    revalidateLedger();
    return actionOk(result);
  });
}

export async function updateLedgerEntryAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.LEDGER_UPDATE_OWN);
    const result = await updateLedgerEntry(
      user,
      id,
      ledgerEntrySchema.parse(input),
    );
    revalidateLedger();
    return actionOk(result);
  });
}

export async function setLedgerStatusAction(
  id: string,
  status: LedgerStatus,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.LEDGER_APPROVE);
    await setLedgerStatus(user, id, z.nativeEnum(LedgerStatus).parse(status));
    revalidateLedger();
    return actionOk({ id });
  });
}

export async function deleteLedgerEntryAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.LEDGER_DELETE);
    await deleteLedgerEntry(user, id);
    revalidateLedger();
    return actionOk({ id });
  });
}
