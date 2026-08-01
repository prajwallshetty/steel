import type { Metadata } from "next";
import { settingsRepository } from "@/lib/repository";
import { saveSettingsAction } from "@/lib/actions/settings";
import { formatTimestamp } from "@/lib/format/number";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { PageHeading } from "@/components/layout/PageHeading";

export const metadata: Metadata = { title: "Admin settings" };

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await settingsRepository.get();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeading
        title="Admin settings"
        description="Master data and pricing defaults. Changes apply to future quotations only — quotations already saved keep the rates they were issued with."
        backHref="/quotations"
        backLabel="All quotations"
      />

      <p className="text-xs text-muted-foreground">
        Last updated {formatTimestamp(settings.updatedAt)}
      </p>

      <SettingsForm settings={settings} onSave={saveSettingsAction} />
    </div>
  );
}
