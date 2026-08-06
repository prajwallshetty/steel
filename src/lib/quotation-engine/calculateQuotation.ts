import type {
  CalculatedQuotation,
  CalculatedRow,
  Quotation,
  QuotationRowInput,
  SizeCode,
} from "@/types/quotation";
import type { AppSettings } from "@/types/settings";
import { calculateRow } from "./calculateRow";
import { calculateTotals } from "./calculateTotals";

/**
 * Decide which sizes carry the green band.
 *
 * Precedence: an explicit per-row flag wins; then an explicit admin list; then
 * the template's own convention — sizes priced above the base diameter-
 * difference tier are highlighted. That last rule is what reproduces the
 * reference sheet (8MM and 32MM at 6500 against a 5500 base) and keeps working
 * when an admin edits the difference map.
 */
export function resolveHighlightedSizes(
  rows: readonly QuotationRowInput[],
  highlightSizes: readonly SizeCode[],
): ReadonlySet<SizeCode> {
  if (highlightSizes.length > 0) return new Set(highlightSizes);

  const positiveDifferences = rows
    .map((row) => row.difference)
    .filter((difference) => difference > 0);

  if (positiveDifferences.length === 0) return new Set();

  const baseTier = Math.min(...positiveDifferences);
  return new Set(
    rows.filter((row) => row.difference > baseTier).map((row) => row.size),
  );
}

/**
 * Resolve a whole quotation: every row, then the totals.
 *
 * Pure and synchronous — safe to call on every keystroke, and the only place
 * the UI ever needs to ask for numbers.
 */
export function calculateQuotation(
  quotation: Quotation,
  settings: AppSettings,
): CalculatedQuotation {
  const highlighted = resolveHighlightedSizes(
    quotation.rows,
    settings.highlightSizes,
  );

  const rows: CalculatedRow[] = quotation.rows.map((row) =>
    calculateRow(row, {
      discountBase: settings.pricing.discountBase,
      highlighted: row.highlight ?? highlighted.has(row.size),
      cdType: quotation.header.cdType,
    }),
  );

  return {
    id: quotation.id,
    reference: quotation.reference,
    status: quotation.status,
    header: quotation.header,
    rows,
    totals: calculateTotals(rows),
    remarks: quotation.remarks,
    createdBy: quotation.createdBy,
    createdAt: quotation.createdAt,
    updatedAt: quotation.updatedAt,
  };
}
