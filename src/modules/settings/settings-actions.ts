"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { authorizeAction } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import { recordAudit } from "@/modules/audit/audit-service";
import {
  actionOk,
  runAction,
  type ActionResult,
} from "@/modules/shared/action-result";
import { appSettingsSchema } from "@/lib/validation/settings-schema";
import { saveSettings } from "./settings-service";

/**
 * Master settings.
 *
 * Changes apply to future quotations only — stored quotations carry their own
 * rates on every row and are never recalculated.
 */
export async function saveSettingsAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await authorizeAction(PERMISSIONS.SETTINGS_MANAGE);
    const parsed = appSettingsSchema.parse(input);

    await saveSettings(parsed, user.id, null);

    await recordAudit({
      action: AuditAction.UPDATE,
      entity: "SystemSetting",
      summary: "Updated master pricing settings",
      userId: user.id,
      branchId: user.branchId,
      newValue: {
        sizes: parsed.sizes,
        gstPercent: parsed.pricing.gstPercent,
        defaultBasicRate: parsed.pricing.defaultBasicRate,
      },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/quotations/new");
    return actionOk({ id: "settings" });
  });
}
