"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import type { CalculatedQuotation } from "@/types/quotation";
import type { AppSettings } from "@/types/settings";
import { Button } from "@/components/ui/button";
import { downloadQuotationPdf } from "@/lib/pdf/generate-pdf";

interface QuotationDocumentActionsProps {
  readonly quotation: CalculatedQuotation;
  readonly settings: AppSettings;
  /** Absent for unsaved drafts — printing needs a persisted route. */
  readonly printHref?: string;
}

/**
 * Print and PDF actions.
 *
 * PDF generation runs in the browser against the same calculated quotation the
 * preview is showing, so a user can download an accurate document from an
 * unsaved draft without a server round trip.
 */
export function QuotationDocumentActions({
  quotation,
  settings,
  printHref,
}: QuotationDocumentActionsProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [isRendering, setRendering] = useState(false);

  const handleDownload = async () => {
    setRendering(true);
    try {
      await downloadQuotationPdf(quotation, settings);
      toast.success("PDF downloaded");
    } catch (error) {
      toast.error("Could not generate the PDF", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {printHref && (
        <Button
          type="button"
          variant="outline"
          disabled={isNavigating}
          onClick={() => startNavigation(() => router.push(printHref))}
        >
          {isNavigating ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Printer />
          )}
          Print
        </Button>
      )}
      <Button type="button" onClick={handleDownload} disabled={isRendering}>
        {isRendering ? <Loader2 className="animate-spin" /> : <Download />}
        {isRendering ? "Generating…" : "Download PDF"}
      </Button>
    </div>
  );
}
