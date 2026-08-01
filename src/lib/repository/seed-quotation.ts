import type { Quotation } from "@/types/quotation";
import { SHEET_TITLE } from "@/lib/settings/defaults";

/**
 * The reference quotation, transcribed cell-for-cell from the supplied
 * workbook. It ships as seed data so the sheet can be compared against the
 * original the moment the app starts, and it is the fixture the engine tests
 * reconcile against.
 */
export const REFERENCE_QUOTATION: Quotation = {
  id: "ref-sadguru-2026-07-07",
  reference: "QT-2026-0001",
  status: "finalized",
  header: {
    title: SHEET_TITLE,
    date: "2026-07-07",
    location: "GHOTWADE",
    partyName: "SADGURU TRADERS",
    brand: "SHIRDI",
    basicRateLabel: "40300-4000-R",
    diaDiffLabel: "6500/5500 +295",
    payment: "REGULER",
    vehicleNo: "",
  },
  rows: [
    row("8MM", 1.99, 36300, 6500),
    row("10MM", 7.1, 36300, 5500),
    row("12MM", 3.09, 36300, 5500),
    row("16MM", 0, 0, 5500),
    row("20MM", 0, 0, 5500),
    row("25MM", 0, 0, 5500),
    row("32MM", 0, 0, 6500),
    row("6MM", 0, 0, 0, 0),
  ],
  remarks: "PLEASE CHECK ONCE AND RE-CONFIRM IF ANY MISTAKE.",
  createdBy: "system",
  createdAt: "2026-07-07T04:30:00.000Z",
  updatedAt: "2026-07-07T04:30:00.000Z",
};

function row(
  size: string,
  quantity: number,
  basic: number,
  difference: number,
  loading = 295,
) {
  return {
    id: size,
    size,
    quantity,
    basic,
    difference,
    loading,
    // The sheet advertises 1.5% CD but charges none: the term is REGULER.
    discountPercent: 0,
    gstPercent: 18,
    highlight: null,
  };
}
