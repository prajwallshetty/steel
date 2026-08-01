"use server";

import { revalidatePath } from "next/cache";
import type { SaveResult } from "@/types/actions";
import { settingsRepository } from "@/lib/repository";
import { appSettingsSchema } from "@/lib/validation/settings-schema";

/**
 * Persist admin settings.
 *
 * Settings are defaults for *future* quotations only. Stored quotations carry
 * their own rates on every row and are never recalculated against new
 * settings — an issued price must not change retroactively.
 */
export async function saveSettingsAction(input: unknown): Promise<SaveResult> {
  const parsed = appSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue
        ? `${issue.path.join(".")}: ${issue.message}`
        : "Settings could not be validated.",
    };
  }

  try {
    await settingsRepository.save(parsed.data);
    revalidatePath("/admin/settings");
    revalidatePath("/quotations");
    return { ok: true, id: "settings" };
  } catch {
    return { ok: false, error: "Could not save settings. Please try again." };
  }
}
