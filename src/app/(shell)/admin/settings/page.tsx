import type { Metadata } from "next";
import { requirePermission } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import { getSettings } from "@/modules/settings/settings-service";
import { saveSettingsAction } from "@/modules/settings/settings-actions";
import { formatTimestamp } from "@/lib/format/number";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { PageHeading } from "@/components/layout/PageHeading";

export const metadata: Metadata = { title: "Master settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const settings = await getSettings(null);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeading
        title="Master settings"
        description="Pricing defaults and master data. Changes apply to future quotations only — quotations already saved keep the rates they were issued with."
      />

      <p className="text-xs text-muted-foreground">
        Last updated {formatTimestamp(settings.updatedAt)}
      </p>

      <SettingsForm settings={settings} onSave={saveSettingsAction} />
    </div>
  );
}
