import type { AppSettings } from "@/types/settings";

/**
 * Factory defaults, transcribed from the reference workbook.
 *
 * Editing these in Admin affects future quotations only — stored quotations
 * carry their own rates and are never recalculated against new settings.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  display: {
    numberGrouping: "indian",
  },
  // Sheet order, not numeric order: 6MM sits at the bottom in the workbook.
  sizes: ["8MM", "10MM", "12MM", "16MM", "20MM", "25MM", "32MM", "6MM"],
  differences: {
    "6MM": 0,
    "8MM": 6500,
    "10MM": 5500,
    "12MM": 5500,
    "16MM": 5500,
    "20MM": 5500,
    "25MM": 5500,
    "32MM": 6500,
  },
  pricing: {
    defaultBasicRate: 36300,
    gstPercent: 18,
    nominalDiscountPercent: 1.5,
    defaultDiscountPercent: 0,
    loading: 295,
    discountBase: "before-gst",
  },
  brands: ["SHIRDI", "JSW", "TATA TISCON", "KAMDHENU", "SRMB"],
  locations: ["GHOTWADE", "PUNE", "SHIRDI", "NASHIK", "AHMEDNAGAR"],
  paymentTypes: ["REGULER", "CASH", "ADVANCE", "CREDIT 30 DAYS"],
  // Empty => derive from the diameter-difference tier, reproducing the sheet.
  highlightSizes: [],
  defaultRemarks: "PLEASE CHECK ONCE AND RE-CONFIRM IF ANY MISTAKE.",
  maintenanceMode: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/** The sheet's fixed title cell. */
export const SHEET_TITLE = "DISCOUNT/CD";
