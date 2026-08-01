import type { Metadata } from "next";
import { settingsRepository } from "@/lib/repository";
import { createQuotationAction } from "@/lib/actions/quotations";
import { createEmptyDraft } from "@/lib/quotation/factory";
import { QuotationEditor } from "@/components/quotation/QuotationEditor";
import { PageHeading } from "@/components/layout/PageHeading";

export const metadata: Metadata = { title: "New quotation" };

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const settings = await settingsRepository.get();
  const draft = createEmptyDraft(settings);
  const now = new Date().toISOString();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="New quotation"
        description="Rates and sizes are seeded from Admin settings. Everything can be overridden per row."
        backHref="/quotations"
        backLabel="All quotations"
      />

      <QuotationEditor
        mode="create"
        settings={settings}
        initialDraft={draft}
        meta={{
          id: "draft",
          // Assigned on save; shown only in the preview until then.
          reference: "NEW",
          createdBy: "—",
          createdAt: now,
          updatedAt: now,
        }}
        onSave={createQuotationAction}
      />
    </div>
  );
}
