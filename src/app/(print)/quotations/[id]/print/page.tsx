import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { quotationRepository, settingsRepository } from "@/lib/repository";
import { calculateQuotation } from "@/lib/quotation-engine";
import { QuotationSheet } from "@/components/quotation/QuotationSheet";
import { PrintTrigger } from "@/components/quotation/PrintTrigger";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const quotation = await quotationRepository.findById(id);
  // The document title becomes the default filename in "Save as PDF".
  return {
    title: quotation
      ? `${quotation.reference}_${quotation.header.partyName}`
      : "Print quotation",
  };
}

/**
 * The print view: the sheet and nothing else.
 *
 * Printing from here produces a true vector PDF via the browser's own PDF
 * writer — text stays selectable and rules stay hairline-sharp, exactly as the
 * downloaded PDF does. No canvas, no rasterisation.
 */
export default async function PrintQuotationPage({ params }: PageProps) {
  const { id } = await params;
  const [quotation, settings] = await Promise.all([
    quotationRepository.findById(id),
    settingsRepository.get(),
  ]);

  if (!quotation) notFound();

  const calculated = calculateQuotation(quotation, settings);

  return (
    <>
      <PrintTrigger backHref={`/quotations/${quotation.id}`} />
      <div className="steel-sheet-scroll">
        <div className="steel-sheet-paper">
          <QuotationSheet quotation={calculated} settings={settings} />
        </div>
      </div>
    </>
  );
}
