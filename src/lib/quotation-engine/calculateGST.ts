import { percentOf } from "./money";

/**
 * GST amount charged on a taxable value.
 *
 * The rate is a parameter rather than a constant so the same engine serves
 * 18% steel, 5% slabs, or an exempt line without a branch.
 */
export function calculateGST(taxableValue: number, gstPercent: number): number {
  if (gstPercent === 0 || taxableValue === 0) return 0;
  return percentOf(taxableValue, gstPercent);
}
