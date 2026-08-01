import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { quotationRepository, settingsRepository } from "@/lib/repository";
import { updateQuotationAction } from "@/lib/actions/quotations";
import { QuotationEditor } from "@/components/quotation/QuotationEditor";
import { PageHeading } from "@/components/layout/PageHeading";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const quotation = await quotationRepository.findById(id);
  return { title: quotation ? `Edit ${quotation.reference}` : "Edit quotation" };
}

export default async function EditQuotationPage({ params }: PageProps) {
  const { id } = await params;
  const [quotation, settings] = await Promise.all([
    quotationRepository.findById(id),
    settingsRepository.get(),
  ]);

  if (!quotation) notFound();

  // A finalized quotation is a record of a commitment; editing is refused at
  // the repository too, but bouncing here avoids showing a form that cannot save.
  if (quotation.status === "finalized") {
    redirect(`/quotations/${quotation.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title={`Edit ${quotation.reference}`}
        description={quotation.header.partyName}
        backHref={`/quotations/${quotation.id}`}
        backLabel="Back to quotation"
      />

      <QuotationEditor
        mode="edit"
        settings={settings}
        initialDraft={{
          status: quotation.status,
          header: quotation.header,
          rows: quotation.rows.map((row) => ({ ...row })),
          remarks: quotation.remarks,
        }}
        meta={{
          id: quotation.id,
          reference: quotation.reference,
          createdBy: quotation.createdBy,
          createdAt: quotation.createdAt,
          updatedAt: quotation.updatedAt,
        }}
        onSave={updateQuotationAction.bind(null, quotation.id)}
      />
    </div>
  );
}
