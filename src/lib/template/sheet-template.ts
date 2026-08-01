/**
 * Single source of truth for the quotation sheet's visual geometry.
 *
 * Both the on-screen sheet and the vector PDF derive from these numbers, so the
 * printed output cannot drift from the preview. Everything is authored in
 * millimetres against an A4 landscape page; the screen renderer converts to CSS
 * pixels at 96dpi.
 */

/** A4 landscape page box, in millimetres. */
export const PAGE = {
  widthMm: 297,
  heightMm: 210,
  marginMm: 10,
} as const;

export const CONTENT_WIDTH_MM = PAGE.widthMm - PAGE.marginMm * 2; // 277mm

/** CSS pixels per millimetre at the 96dpi reference used by browsers. */
export const PX_PER_MM = 96 / 25.4;

export const mmToPx = (mm: number): number =>
  Math.round(mm * PX_PER_MM * 1000) / 1000;

/** PDF points per millimetre. PDF user space is 72dpi by definition. */
export const PT_PER_MM = 72 / 25.4;

export const mmToPt = (mm: number): number =>
  Math.round(mm * PT_PER_MM * 1000) / 1000;

/**
 * The eight sheet columns, as a share of the content width. Shares sum to 1 so
 * the grid always spans the full printable area regardless of paper size.
 */
export const COLUMNS = [
  { key: "size", label: "SIZES", share: 0.16 },
  { key: "quantity", label: "QUANTITY", share: 0.125 },
  { key: "basic", label: "BASIC", share: 0.115 },
  { key: "difference", label: "DIFF+ LDG", share: 0.13 },
  { key: "discount", label: "CD", share: 0.115 },
  { key: "gst", label: "GST", share: 0.125 },
  { key: "rate", label: "RATE", share: 0.11 },
  { key: "total", label: "TOTAL", share: 0.12 },
] as const;

export type ColumnKey = (typeof COLUMNS)[number]["key"];

export const COLUMN_COUNT = COLUMNS.length;

/** Column widths in millimetres, for the PDF renderer. */
export const COLUMN_WIDTHS_MM: readonly number[] = COLUMNS.map(
  (c) => c.share * CONTENT_WIDTH_MM,
);

/** Row heights in millimetres, matched to the reference sheet's proportions. */
export const ROW_HEIGHT_MM = {
  title: 9,
  header: 9,
  tableHead: 13,
  data: 9,
  total: 9,
  note: 7,
} as const;

/** Excel's exact fill colours from the reference workbook. */
export const SHEET_COLORS = {
  /** Header label + table head fill. */
  amber: "#FFC000",
  /** Highlight band on premium-diameter rows. */
  green: "#A9D08E",
  white: "#FFFFFF",
  border: "#000000",
  text: "#000000",
  /** The grand-total figure. */
  danger: "#FF0000",
} as const;

/** Point sizes, chosen so the sheet reads like 10pt Calibri in Excel. */
export const SHEET_FONT_PT = {
  title: 10,
  header: 10,
  tableHead: 10,
  data: 10,
  total: 10,
  note: 8,
} as const;

export const BORDER_WIDTH_MM = 0.25;

/**
 * The font stack. Calibri first so a machine with Office installed renders
 * character-for-character like the original workbook.
 */
export const SHEET_FONT_FAMILY =
  "Calibri, 'Segoe UI', Carlito, Arial, Helvetica, sans-serif";

/**
 * Header block layout. Each cell declares how many of the eight grid columns it
 * spans, mirroring the merged cells in the workbook.
 */
export interface HeaderCellSpec {
  readonly kind: "label" | "value";
  /** Which `QuotationHeader` field a value cell binds to. */
  readonly field?:
    | "date"
    | "location"
    | "partyName"
    | "brand"
    | "basicRateLabel"
    | "diaDiffLabel"
    | "payment"
    | "vehicleNo";
  readonly text?: string;
  readonly span: number;
  readonly fill: string;
  readonly align: "left" | "center";
}

export const HEADER_ROWS: readonly (readonly HeaderCellSpec[])[] = [
  [
    {
      kind: "label",
      text: "DATE:",
      span: 1,
      fill: SHEET_COLORS.amber,
      align: "left",
    },
    {
      kind: "value",
      field: "date",
      span: 3,
      fill: SHEET_COLORS.white,
      align: "left",
    },
    {
      kind: "label",
      text: "LOCATION :",
      span: 2,
      fill: SHEET_COLORS.amber,
      align: "center",
    },
    {
      kind: "value",
      field: "location",
      span: 2,
      fill: SHEET_COLORS.white,
      align: "center",
    },
  ],
  [
    {
      kind: "label",
      text: "PARTY NAME",
      span: 1,
      fill: SHEET_COLORS.white,
      align: "left",
    },
    {
      kind: "value",
      field: "partyName",
      span: 3,
      fill: SHEET_COLORS.white,
      align: "left",
    },
    {
      kind: "label",
      text: "BRAND",
      span: 2,
      fill: SHEET_COLORS.amber,
      align: "center",
    },
    {
      kind: "value",
      field: "brand",
      span: 2,
      fill: SHEET_COLORS.white,
      align: "center",
    },
  ],
  [
    {
      kind: "label",
      text: "BASIC RATE",
      span: 1,
      fill: SHEET_COLORS.white,
      align: "left",
    },
    {
      kind: "value",
      field: "basicRateLabel",
      span: 7,
      fill: SHEET_COLORS.white,
      align: "left",
    },
  ],
  [
    {
      kind: "label",
      text: "DIA DIFF",
      span: 1,
      fill: SHEET_COLORS.white,
      align: "left",
    },
    {
      kind: "value",
      field: "diaDiffLabel",
      span: 7,
      fill: SHEET_COLORS.white,
      align: "left",
    },
  ],
  [
    {
      kind: "label",
      text: "PAYMENT",
      span: 1,
      fill: SHEET_COLORS.white,
      align: "left",
    },
    {
      kind: "value",
      field: "payment",
      span: 7,
      fill: SHEET_COLORS.white,
      align: "left",
    },
  ],
  [
    {
      kind: "label",
      text: "VEHICAL NO.",
      span: 1,
      fill: SHEET_COLORS.white,
      align: "left",
    },
    {
      kind: "value",
      field: "vehicleNo",
      span: 7,
      fill: SHEET_COLORS.white,
      align: "left",
    },
  ],
];
