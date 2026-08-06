/**
 * Domain model for the Discount/CD quotation.
 *
 * Money is stored at ENGINE_PRECISION (6dp) and only rounded at the
 * presentation boundary. Nothing in this file knows about React or PDF.
 */

/**
 * Quotation lifecycle, mirroring the `QuotationStatus` enum in the database.
 *
 * The engine and the sheet never branch on this — it is carried through
 * untouched — so the workflow can grow states without any risk to the printed
 * document or its arithmetic.
 */
export type QuotationStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "CANCELLED";

/** States in which a quotation is still editable by its owner. */
export const EDITABLE_STATUSES: readonly QuotationStatus[] = [
  "DRAFT",
  "REJECTED",
];

/** States that represent a committed, printable document. */
export const COMMITTED_STATUSES: readonly QuotationStatus[] = [
  "APPROVED",
  "COMPLETED",
];

/** A material size key, e.g. "8MM". Free-form so admins can add sizes. */
export type SizeCode = string;

/**
 * The user-editable part of a row. Everything else is derived by the engine.
 */
export interface QuotationRowInput {
  /** Stable id so React keys and keyboard nav survive reordering. */
  readonly id: string;
  readonly size: SizeCode;
  readonly quantity: number;
  /** Net basic rate for this size (header basic minus any scheme deduction). */
  readonly basic: number;
  /** Diameter difference for this size, seeded from settings, overridable. */
  readonly difference: number;
  /** Loading / freight added on top of the diameter difference. */
  readonly loading: number;
  /** Cash discount percentage applied to this row, e.g. 1.5 */
  readonly discountPercent: number;
  /** GST percentage applied to this row, e.g. 18 */
  readonly gstPercent: number;
  /**
   * Template highlight (green band). Null means "derive from the diameter
   * difference tier"; a boolean is an explicit author override.
   */
  readonly highlight: boolean | null;
}

/** Engine output for a single row. All values carry full 6dp precision. */
export interface CalculatedRow extends QuotationRowInput {
  /** difference + loading — the "DIFF+ LDG" column. */
  readonly differencePlusLoading: number;
  /** basic + differencePlusLoading, before discount. */
  readonly grossRate: number;
  /** Absolute cash-discount amount (positive number, subtracted downstream). */
  readonly discountAmount: number;
  /** Value GST is charged on: grossRate - discountAmount. */
  readonly taxableValue: number;
  /** Absolute GST amount. */
  readonly gstAmount: number;
  /** Final per-unit rate: taxableValue + gstAmount. */
  readonly rate: number;
  /** quantity * rate. */
  readonly total: number;
  /** True when the row should render with the green template band. */
  readonly isHighlighted: boolean;
}

export interface QuotationHeader {
  /** Sheet title cell — "DISCOUNT/CD" in the reference template. */
  readonly title: string;
  /** ISO yyyy-mm-dd. Formatted for display at the presentation boundary. */
  readonly date: string;
  readonly location: string;
  readonly partyName: string;
  readonly brand: string;
  /**
   * Display text for the BASIC RATE cell, e.g. "40300-4000-R". This is a
   * human-readable summary; the authoritative numbers live on each row.
   */
  readonly basicRateLabel: string;
  /** Display text for the DIA DIFF cell, e.g. "6500/5500 +295". */
  readonly diaDiffLabel: string;
  readonly payment: string;
  readonly cdType: "basic" | "basic-diff" | "gross";
  readonly vehicleNo: string;
}

export interface QuotationTotals {
  readonly totalQuantity: number;
  /** Sum of unrounded line totals. */
  readonly subTotal: number;
  readonly totalDiscount: number;
  readonly totalGst: number;
  /** subTotal rounded to the nearest rupee — the red figure on the sheet. */
  readonly grandTotal: number;
}

/** Organisational context attached to a stored quotation. */
export interface QuotationOwnership {
  readonly branchId: string;
  readonly branchName: string;
  readonly branchCode: string;
  readonly customerId: string | null;
  /** Owning manager — drives the "own records only" scope. */
  readonly assignedToId: string | null;
  readonly assignedToName: string | null;
  readonly approvedByName: string | null;
  readonly approvedAt: string | null;
  readonly rejectionReason: string | null;
}

export interface Quotation {
  readonly id: string;
  readonly reference: string;
  readonly status: QuotationStatus;
  readonly header: QuotationHeader;
  readonly rows: readonly QuotationRowInput[];
  readonly remarks: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Absent on an unsaved draft being composed in the editor. */
  readonly ownership?: QuotationOwnership;
}

/** A quotation with every derived figure resolved. */
export interface CalculatedQuotation {
  readonly id: string;
  readonly reference: string;
  readonly status: QuotationStatus;
  readonly header: QuotationHeader;
  readonly rows: readonly CalculatedRow[];
  readonly totals: QuotationTotals;
  readonly remarks: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Payload accepted by create/update — server owns ids and timestamps. */
export type QuotationDraft = Pick<
  Quotation,
  "header" | "rows" | "remarks" | "status"
>;
