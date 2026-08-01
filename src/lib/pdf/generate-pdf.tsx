"use client";

import type { CalculatedQuotation } from "@/types/quotation";
import type { AppSettings } from "@/types/settings";

/**
 * Build and download the vector PDF in the browser.
 *
 * The renderer is imported lazily: `@react-pdf/renderer` is a large, DOM-free
 * bundle that nothing needs until the user actually asks for a download, and
 * keeping it out of the server graph avoids pulling it into SSR.
 */
export async function downloadQuotationPdf(
  quotation: CalculatedQuotation,
  settings: AppSettings,
): Promise<void> {
  const blob = await renderQuotationPdf(quotation, settings);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${buildFileName(quotation)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Revoke on the next frame so the navigation has committed first.
    requestAnimationFrame(() => URL.revokeObjectURL(url));
  }
}

/** Render to a Blob without downloading — used by the in-page PDF preview. */
export async function renderQuotationPdf(
  quotation: CalculatedQuotation,
  settings: AppSettings,
): Promise<Blob> {
  const [{ pdf }, { QuotationPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./QuotationPdfDocument"),
  ]);

  return pdf(
    <QuotationPdfDocument quotation={quotation} settings={settings} />,
  ).toBlob();
}

function buildFileName(quotation: CalculatedQuotation): string {
  const party = quotation.header.partyName
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .toUpperCase();
  return [quotation.reference, party || "QUOTATION", quotation.header.date]
    .filter(Boolean)
    .join("_");
}
