"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SaveResult } from "@/types/actions";
import {
  ConflictError,
  NotFoundError,
  quotationRepository,
} from "@/lib/repository";
import { getCurrentUser } from "@/lib/auth/current-user";
import { quotationDraftSchema } from "@/lib/validation/quotation-schema";

/**
 * Write paths for quotations.
 *
 * Every action re-validates its payload with the same schema the form uses — a
 * server action is a public HTTP endpoint, so client-side validation is a
 * convenience, never the enforcement point.
 */

export async function createQuotationAction(
  draft: unknown,
): Promise<SaveResult> {
  const parsed = quotationDraftSchema.safeParse(draft);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  try {
    const user = await getCurrentUser();
    const created = await quotationRepository.create(parsed.data, user.name);
    revalidatePath("/quotations");
    return { ok: true, id: created.id };
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
}

export async function updateQuotationAction(
  id: string,
  draft: unknown,
): Promise<SaveResult> {
  const parsed = quotationDraftSchema.safeParse(draft);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues) };
  }

  try {
    const updated = await quotationRepository.update(id, parsed.data);
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${id}`);
    return { ok: true, id: updated.id };
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
}

/** Copy a quotation into a new draft and open it for editing. */
export async function duplicateQuotationAction(id: string): Promise<void> {
  const source = await quotationRepository.findById(id);
  if (!source) throw new NotFoundError("Quotation", id);

  const user = await getCurrentUser();
  const created = await quotationRepository.create(
    {
      status: "draft",
      header: {
        ...source.header,
        date: new Date().toISOString().slice(0, 10),
        vehicleNo: "",
      },
      rows: source.rows.map((row) => ({ ...row })),
      remarks: source.remarks,
    },
    user.name,
  );

  revalidatePath("/quotations");
  redirect(`/quotations/${created.id}/edit`);
}

export async function deleteQuotationAction(id: string): Promise<void> {
  await quotationRepository.remove(id);
  revalidatePath("/quotations");
  redirect("/quotations");
}

function firstIssue(
  issues: readonly { path: PropertyKey[]; message: string }[],
): string {
  const issue = issues[0];
  if (!issue) return "The quotation could not be validated.";
  const field = issue.path.filter((part) => typeof part === "string").join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

function describe(error: unknown): string {
  if (error instanceof ConflictError || error instanceof NotFoundError) {
    return error.message;
  }
  return "Something went wrong while saving. Please try again.";
}
