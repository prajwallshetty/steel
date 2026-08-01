import type { SizeCode } from "./quotation";

/**
 * Order in which the engine applies adjustments. Exposed as configuration so a
 * future template can charge GST on the pre-discount value without touching
 * either the engine internals or the UI.
 */
export type DiscountBase = "before-gst" | "after-gst";

/** Mapping of size -> diameter difference, e.g. { "8MM": 6500 }. */
export type DifferenceMap = Readonly<Record<SizeCode, number>>;

export interface PricingRules {
  /** Default net basic rate seeded into new rows. */
  readonly defaultBasicRate: number;
  /** GST percentage seeded into new rows, and shown in the GST column head. */
  readonly gstPercent: number;
  /**
   * The scheme's nominal cash discount. This drives the "1.5% CD" column
   * heading only — it is a description of the terms, not an applied rate. The
   * reference sheet advertises 1.5% while charging nothing, because the
   * payment term is REGULER rather than cash.
   */
  readonly nominalDiscountPercent: number;
  /** Cash-discount percentage actually seeded into new rows. */
  readonly defaultDiscountPercent: number;
  /** Default loading/freight added to the diameter difference. */
  readonly loading: number;
  /** Whether the cash discount reduces the GST base. */
  readonly discountBase: DiscountBase;
}

/**
 * Digit grouping for money cells. The source workbook prints ungrouped
 * (`607354`); the system default follows the Indian convention (`6,07,354`).
 */
export type NumberGrouping = "indian" | "none";

export interface DisplaySettings {
  readonly numberGrouping: NumberGrouping;
}

export interface AppSettings {
  readonly display: DisplaySettings;
  /** Sizes in the exact order they should appear on the sheet. */
  readonly sizes: readonly SizeCode[];
  readonly differences: DifferenceMap;
  readonly pricing: PricingRules;
  readonly brands: readonly string[];
  readonly locations: readonly string[];
  readonly paymentTypes: readonly string[];
  /**
   * Sizes always rendered with the green band. Empty means "derive from the
   * diameter-difference tier", which reproduces the reference sheet.
   */
  readonly highlightSizes: readonly SizeCode[];
  readonly defaultRemarks: string;
  readonly updatedAt: string;
}
