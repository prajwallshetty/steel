import type { CalculatedRow, QuotationTotals } from "@/types/quotation";
import { toEnginePrecision, toRupees } from "./money";

/**
 * Aggregate resolved rows into sheet totals.
 *
 * Line totals are summed at full precision and rounded once, at the end. The
 * reference sheet's 6,07,354 is only reachable this way — rounding each line
 * first yields 6,07,355.
 */
export function calculateTotals(rows: readonly CalculatedRow[]): QuotationTotals {
  let totalQuantity = 0;
  let subTotal = 0;
  let totalDiscount = 0;
  let totalGst = 0;

  for (const row of rows) {
    totalQuantity += row.quantity;
    subTotal += row.total;
    totalDiscount += row.discountAmount * row.quantity;
    totalGst += row.gstAmount * row.quantity;
  }

  return {
    totalQuantity: toEnginePrecision(totalQuantity),
    subTotal: toEnginePrecision(subTotal),
    totalDiscount: toEnginePrecision(totalDiscount),
    totalGst: toEnginePrecision(totalGst),
    grandTotal: toRupees(subTotal),
  };
}
