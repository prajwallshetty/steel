import type { Quotation } from "@/types/quotation";
import type { AppSettings } from "@/types/settings";
import { SHEET_TITLE } from "@/lib/settings/defaults";
import type { QuotationDraftInput } from "@/lib/validation/quotation-schema";

/**
 * Draft factories.
 *
 * These produce `QuotationDraftInput` — the schema-inferred, mutable shape —
 * rather than the readonly domain `QuotationDraft`, because their only consumer
 * is the form, and `useFieldArray` must be able to splice the rows array. The
 * domain type stays readonly where it belongs: in the store and the engine.
 */

/** Build the row set for a new quotation from the current admin settings. */
export function createRowsFromSettings(
  settings: AppSettings,
): QuotationDraftInput["rows"] {
  return settings.sizes.map((size) => ({
    id: size,
    size,
    quantity: 0,
    basic: settings.pricing.defaultBasicRate,
    difference: settings.differences[size] ?? 0,
    loading: settings.differences[size] ? settings.pricing.loading : 0,
    discountPercent: settings.pricing.defaultDiscountPercent,
    gstPercent: settings.pricing.gstPercent,
    highlight: null,
  }));
}

/**
 * Compose the DIA DIFF caption from the difference map, e.g. `6500/5500 +295`.
 * Users may overwrite it — it is free text on the sheet.
 */
export function deriveDiaDiffLabel(settings: AppSettings): string {
  const tiers = [
    ...new Set(
      settings.sizes
        .map((size) => settings.differences[size] ?? 0)
        .filter((difference) => difference > 0),
    ),
  ].sort((a, b) => b - a);

  if (tiers.length === 0) return "";
  const loading = settings.pricing.loading;
  return loading > 0 ? `${tiers.join("/")} +${loading}` : tiers.join("/");
}

/** A blank draft, pre-populated so the sheet is immediately recognisable. */
export function createEmptyDraft(settings: AppSettings): QuotationDraftInput {
  return {
    status: "DRAFT",
    header: {
      title: SHEET_TITLE,
      date: new Date().toISOString().slice(0, 10),
      location: settings.locations[0] ?? "",
      partyName: "",
      brand: settings.brands[0] ?? "",
      basicRateLabel: String(settings.pricing.defaultBasicRate),
      diaDiffLabel: deriveDiaDiffLabel(settings),
      payment: settings.paymentTypes[0] ?? "",
      vehicleNo: "",
    },
    rows: createRowsFromSettings(settings),
    remarks: settings.defaultRemarks,
  };
}

/** Copy an existing quotation into a fresh, unsaved draft. */
export function duplicateAsDraft(source: Quotation): QuotationDraftInput {
  return {
    status: "DRAFT",
    header: {
      ...source.header,
      date: new Date().toISOString().slice(0, 10),
      vehicleNo: "",
    },
    rows: source.rows.map((row) => ({ ...row })),
    remarks: source.remarks,
  };
}
