import type { CalculatedRow, QuotationRowInput } from "@/types/quotation";
import type { DiscountBase } from "@/types/settings";
import { applyDiscount, calculateDiscount } from "./calculateDiscount";
import { calculateGST } from "./calculateGST";
import { toEnginePrecision } from "./money";

export interface RowCalculationOptions {
  /** Whether the cash discount reduces the GST base. */
  readonly discountBase: DiscountBase;
  /** Resolved by `calculateQuotation`; overrides the row's own flag. */
  readonly highlighted: boolean;
  /** Cash discount calculation type. Defaults to 'basic-diff'. */
  readonly cdType?: "basic" | "basic-diff" | "gross";
}

/**
 * Resolve one material row.
 *
 * The pipeline is:
 *   basic
 *     + (difference + loading)      -> gross rate
 *     - cash discount               -> taxable value
 *     + GST                         -> final rate
 *     x quantity                    -> line total
 *
 * `discountBase: "after-gst"` moves the discount below the tax line for
 * jurisdictions that tax the undiscounted value.
 */
export function calculateRow(
  input: QuotationRowInput,
  options: RowCalculationOptions,
): CalculatedRow {
  const effectiveBasic = input.quantity === 0 ? 0 : input.basic;
  const differencePlusLoading = toEnginePrecision(input.difference + input.loading);
  const grossRate = toEnginePrecision(effectiveBasic + differencePlusLoading);

  // CD calculation based on cdType:
  // - basic: basic rate * CD%
  // - basic-diff: (basic rate + Dia diff) * CD%
  // - gross: (basic rate + Dia diff + loading) * CD%
  let discountBaseValue = effectiveBasic;
  if (!options.cdType || options.cdType === "basic-diff") {
    discountBaseValue = effectiveBasic + input.difference;
  } else if (options.cdType === "gross") {
    discountBaseValue = effectiveBasic + input.difference + input.loading;
  }
  const discountAmount = calculateDiscount(toEnginePrecision(discountBaseValue), input.discountPercent);

  const taxableValue =
    options.discountBase === "before-gst"
      ? applyDiscount(grossRate, discountAmount)
      : grossRate;

  const gstAmount = calculateGST(taxableValue, input.gstPercent);

  const rate =
    options.discountBase === "before-gst"
      ? toEnginePrecision(taxableValue + gstAmount)
      : toEnginePrecision(grossRate + gstAmount - discountAmount);

  const total = toEnginePrecision(input.quantity * rate);

  return {
    ...input,
    basic: effectiveBasic,
    differencePlusLoading,
    grossRate,
    discountAmount,
    taxableValue,
    gstAmount,
    rate,
    total,
    isHighlighted: options.highlighted,
  };
}
