import { describe, expect, it } from "vitest";
import { calculateQuotation } from "./calculateQuotation";
import { calculateRow } from "./calculateRow";
import { calculateTotals } from "./calculateTotals";
import { roundFinancial, toFiniteNumber } from "./money";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { REFERENCE_QUOTATION } from "@/lib/fixtures/reference-quotation";
import { formatMoney, formatQuantity } from "@/lib/format/number";
import type { AppSettings } from "@/types/settings";

const settings = DEFAULT_SETTINGS;

/**
 * The reference workbook is the specification. If these figures move, the
 * system has stopped agreeing with the sheet the business actually issues.
 */
describe("reference quotation reconciles with the source workbook", () => {
  const result = calculateQuotation(REFERENCE_QUOTATION, settings);
  const bySize = new Map(result.rows.map((row) => [row.size, row]));

  it.each([
    // size, diff+ldg, gst,    rate,     total
    ["8MM", 6795, 7757.1, 50852.1, 101195.679],
    ["10MM", 5795, 7577.1, 49672.1, 352671.91],
    ["12MM", 5795, 7577.1, 49672.1, 153486.789],
  ])("prices %s exactly", (size, diff, gst, rate, total) => {
    const row = bySize.get(size as string);
    expect(row).toBeDefined();
    expect(row!.differencePlusLoading).toBe(diff);
    expect(row!.gstAmount).toBe(gst);
    expect(row!.rate).toBe(rate);
    expect(row!.total).toBeCloseTo(total as number, 6);
  });

  it.each([
    ["16MM", 5795, 1043.1, 6838.1],
    ["20MM", 5795, 1043.1, 6838.1],
    ["25MM", 5795, 1043.1, 6838.1],
    ["32MM", 6795, 1223.1, 8018.1],
  ])("prices unstocked size %s from the difference alone", (size, diff, gst, rate) => {
    const row = bySize.get(size as string)!;
    expect(row.differencePlusLoading).toBe(diff);
    expect(row.gstAmount).toBe(gst);
    expect(row.rate).toBe(rate);
    expect(row.total).toBe(0);
  });

  it("displays the rates as whole rupees, as printed", () => {
    expect(formatMoney(bySize.get("8MM")!.rate, "none")).toBe("50852");
    expect(formatMoney(bySize.get("10MM")!.rate, "none")).toBe("49672");
    expect(formatMoney(bySize.get("32MM")!.rate, "none")).toBe("8018");
  });

  it("displays the line totals as printed", () => {
    expect(formatMoney(bySize.get("8MM")!.total, "none")).toBe("101196");
    expect(formatMoney(bySize.get("10MM")!.total, "none")).toBe("352672");
    expect(formatMoney(bySize.get("12MM")!.total, "none")).toBe("153487");
  });

  it("totals 12.18 MT", () => {
    expect(result.totals.totalQuantity).toBe(12.18);
    expect(formatQuantity(result.totals.totalQuantity)).toBe("12.18");
  });

  it("reaches the printed grand total of 607354", () => {
    expect(result.totals.grandTotal).toBe(607354);
    expect(formatMoney(result.totals.grandTotal, "none")).toBe("607354");
    expect(formatMoney(result.totals.grandTotal, "indian")).toBe("6,07,354");
  });

  it("would miss the grand total if lines were rounded before summing", () => {
    // Guards the precision decision: this is the bug the 6dp pipeline avoids.
    const naive = result.rows.reduce(
      (sum, row) => sum + Math.round(row.total),
      0,
    );
    expect(naive).toBe(607355);
    expect(naive).not.toBe(result.totals.grandTotal);
  });

  it("highlights exactly the premium-diameter sizes", () => {
    const highlighted = result.rows
      .filter((row) => row.isHighlighted)
      .map((row) => row.size);
    expect(highlighted).toEqual(["8MM", "32MM"]);
  });
});

describe("cash discount", () => {
  const row = {
    id: "8MM",
    size: "8MM",
    quantity: 2,
    basic: 36300,
    difference: 6500,
    loading: 295,
    discountPercent: 1.5,
    gstPercent: 18,
    highlight: null,
  };

  it("reduces the GST base when applied before tax", () => {
    const result = calculateRow(row, {
      discountBase: "before-gst",
      highlighted: false,
    });
    expect(result.grossRate).toBe(43095);
    expect(result.discountAmount).toBe(642);
    expect(result.taxableValue).toBe(42453);
    expect(result.gstAmount).toBe(7641.54);
    expect(result.rate).toBe(50094.54);
    expect(result.total).toBe(100189.08);
  });

  it("taxes the gross when applied after tax", () => {
    const result = calculateRow(row, {
      discountBase: "after-gst",
      highlighted: false,
    });
    expect(result.taxableValue).toBe(43095);
    expect(result.gstAmount).toBe(7757.1);
    // 43095 + 7757.1 - 642
    expect(result.rate).toBe(50210.1);
  });

  it("is a no-op at 0%, which is what the reference sheet charges", () => {
    const result = calculateRow(
      { ...row, discountPercent: 0 },
      { discountBase: "before-gst", highlighted: false },
    );
    expect(result.discountAmount).toBe(0);
    expect(result.rate).toBe(50852.1);
  });

  it("calculates discount on basic rate only", () => {
    const result = calculateRow(row, {
      discountBase: "before-gst",
      highlighted: false,
      cdType: "basic",
    });
    // 36300 * 1.5% = 544.5
    expect(result.discountAmount).toBe(544.5);
  });

  it("calculates discount on basic + difference", () => {
    const result = calculateRow(row, {
      discountBase: "before-gst",
      highlighted: false,
      cdType: "basic-diff",
    });
    // (36300 + 6500) * 1.5% = 42800 * 1.5% = 642
    expect(result.discountAmount).toBe(642);
  });

  it("calculates discount on gross rate (basic + difference + loading)", () => {
    const result = calculateRow(row, {
      discountBase: "before-gst",
      highlighted: false,
      cdType: "gross",
    });
    // (36300 + 6500 + 295) * 1.5% = 43095 * 1.5% = 646.425
    expect(result.discountAmount).toBe(646.425);
  });
});

describe("settings drive the engine rather than constants", () => {
  it("applies a different GST rate without touching the pipeline", () => {
    const result = calculateRow(
      {
        id: "12MM",
        size: "12MM",
        quantity: 1,
        basic: 40000,
        difference: 0,
        loading: 0,
        discountPercent: 0,
        gstPercent: 5,
      highlight: null,
      },
      { discountBase: "before-gst", highlighted: false },
    );
    expect(result.gstAmount).toBe(2000);
    expect(result.rate).toBe(42000);
  });

  it("re-tiers the highlight when the difference map changes", () => {
    const reTiered: AppSettings = {
      ...settings,
      differences: { ...settings.differences, "12MM": 9000 },
    };
    const quotation = {
      ...REFERENCE_QUOTATION,
      rows: REFERENCE_QUOTATION.rows.map((row) =>
        row.size === "12MM" ? { ...row, difference: 9000 } : row,
      ),
    };
    const highlighted = calculateQuotation(quotation, reTiered)
      .rows.filter((row) => row.isHighlighted)
      .map((row) => row.size);
    expect(highlighted).toEqual(["8MM", "12MM", "32MM"]);
  });

  it("lets an explicit admin list override the derived tiers", () => {
    const pinned: AppSettings = { ...settings, highlightSizes: ["10MM"] };
    const highlighted = calculateQuotation(REFERENCE_QUOTATION, pinned)
      .rows.filter((row) => row.isHighlighted)
      .map((row) => row.size);
    expect(highlighted).toEqual(["10MM"]);
  });
});

describe("financial rounding", () => {
  it("rounds half away from zero, like Excel's ROUND", () => {
    expect(roundFinancial(2.5, 0)).toBe(3);
    expect(roundFinancial(-2.5, 0)).toBe(-3);
    expect(roundFinancial(0.5, 0)).toBe(1);
  });

  it("survives binary representation error", () => {
    // 1.005 * 100 is 100.49999999999999 in IEEE-754.
    expect(roundFinancial(1.005, 2)).toBe(1.01);
    expect(roundFinancial(8.575, 2)).toBe(8.58);
  });

  it("never emits negative zero into a total", () => {
    expect(Object.is(roundFinancial(-0.4, 0), -0)).toBe(true);
    expect(formatMoney(-0.4)).toBe("0");
  });
});

describe("input coercion", () => {
  it("treats blank and malformed cells as zero rather than NaN", () => {
    expect(toFiniteNumber("")).toBe(0);
    expect(toFiniteNumber("   ")).toBe(0);
    expect(toFiniteNumber("abc")).toBe(0);
    expect(toFiniteNumber(Number.NaN)).toBe(0);
    expect(toFiniteNumber(null)).toBe(0);
  });

  it("accepts grouped figures pasted out of Excel", () => {
    expect(toFiniteNumber("6,07,354")).toBe(607354);
    expect(toFiniteNumber("40,300")).toBe(40300);
  });

  it("keeps a partially typed decimal usable", () => {
    expect(toFiniteNumber("1.")).toBe(1);
    expect(toFiniteNumber("1.9")).toBe(1.9);
  });
});

describe("totals", () => {
  it("returns zeros for an empty sheet rather than NaN", () => {
    const totals = calculateTotals([]);
    expect(totals.grandTotal).toBe(0);
    expect(totals.totalQuantity).toBe(0);
    expect(totals.subTotal).toBe(0);
  });

  it("accumulates tax and discount across the quantity, not per unit", () => {
    const rows = [
      calculateRow(
        {
          id: "8MM",
          size: "8MM",
          quantity: 2,
          basic: 1000,
          difference: 0,
          loading: 0,
          discountPercent: 10,
          gstPercent: 18,
          highlight: null,
        },
        { discountBase: "before-gst", highlighted: false },
      ),
    ];
    const totals = calculateTotals(rows);
    expect(totals.totalDiscount).toBe(200); // 100 per MT x 2
    expect(totals.totalGst).toBe(324); // 162 per MT x 2
    expect(totals.grandTotal).toBe(2124);
  });
});
