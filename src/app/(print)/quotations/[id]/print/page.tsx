import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAnyPermission } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import { getQuotation } from "@/modules/quotations/quotation-service";
import { getSettings } from "@/modules/settings/settings-service";
import { calculateQuotation } from "@/lib/quotation-engine";
import { QuotationSheet } from "@/components/quotation/QuotationSheet";
import { PrintTrigger } from "@/components/quotation/PrintTrigger";

export const dynamic = "force-dynamic";

const VIEW_PERMISSIONS = [
  PERMISSIONS.QUOTATION_VIEW_ALL,
  PERMISSIONS.QUOTATION_VIEW_BRANCH,
  PERMISSIONS.QUOTATION_VIEW_OWN,
] as const;

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Print ${id.slice(0, 6)}` };
}

/**
 * The print view: the sheet and nothing else.
 *
 * Authorised exactly like the preview — the document is fetched through the
 * scoped service, so a print URL cannot be used to read another branch's
 * quotation.
 *
 * Printing from here produces a true vector PDF via the browser's own PDF
 * writer: text stays selectable and rules stay hairline-sharp. No canvas, no
 * rasterisation.
 */
export default async function PrintQuotationPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAnyPermission(VIEW_PERMISSIONS);

  const quotation = await getQuotation(user, id);
  if (!quotation) notFound();

  const settings = await getSettings(quotation.ownership?.branchId);
  const calculated = calculateQuotation(quotation, settings);

  return (
    <>
      <PrintTrigger backHref={`/quotations/${id}`} />
      <div className="steel-sheet-scroll">
        <div className="steel-sheet-paper">
          <QuotationSheet quotation={calculated} settings={settings} />
        </div>
      </div>
    </>
  );
}
