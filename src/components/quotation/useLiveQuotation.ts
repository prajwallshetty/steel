"use client";

import { useMemo } from "react";
import type { CalculatedQuotation, Quotation, QuotationStatus } from "@/types/quotation";
import type { AppSettings } from "@/types/settings";
import { calculateQuotation } from "@/lib/quotation-engine";
import type { QuotationDraftInput } from "@/lib/validation/quotation-schema";

export interface QuotationMetadata {
  readonly id: string;
  readonly reference: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Resolve the form's current values through the engine.
 *
 * The engine is pure and cheap, so recalculating a whole sheet per keystroke is
 * cheaper than any incremental scheme would be — but the result is memoised on
 * the watched values so the sheet preview and PDF button only re-render when a
 * number actually changed.
 */
export function useLiveQuotation(
  draft: QuotationDraftInput,
  settings: AppSettings,
  meta: QuotationMetadata,
): CalculatedQuotation {
  return useMemo(() => {
    const quotation: Quotation = {
      ...meta,
      status: draft.status as QuotationStatus,
      header: draft.header,
      rows: draft.rows,
      remarks: draft.remarks,
    };
    return calculateQuotation(quotation, settings);
  }, [draft, settings, meta]);
}
