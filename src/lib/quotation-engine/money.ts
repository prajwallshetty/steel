/**
 * Financial rounding primitives.
 *
 * The engine carries every intermediate value at ENGINE_PRECISION and rounds
 * only when a figure is presented or committed. Rounding each line first and
 * then summing would drift the grand total by a rupee or more across a sheet,
 * which is exactly the discrepancy the source workbook avoids.
 */

/** Decimal places retained for all stored/intermediate money values. */
export const ENGINE_PRECISION = 6;

/** Decimal places used when a figure is shown as currency. */
export const DISPLAY_PRECISION = 2;

/**
 * Round half away from zero — the behaviour of Excel's ROUND(), and the
 * convention Indian invoicing expects. `Math.round` is half-toward-positive,
 * which rounds -0.5 to 0 and would understate credits, so we normalise on the
 * magnitude and reapply the sign.
 */
export function roundFinancial(value: number, decimals = ENGINE_PRECISION): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  const scaled = value * factor;
  // Re-materialise the scaled value at 15 significant digits so binary
  // representation error (e.g. 1.005 * 100 === 100.49999999999999) does not
  // tip a genuine half-way value down.
  const corrected = Number(scaled.toPrecision(15));
  const rounded = Math.round(Math.abs(corrected)) * Math.sign(corrected);
  return rounded / factor;
}

/** Normalise a stored money value to the engine's working precision. */
export const toEnginePrecision = (value: number): number =>
  roundFinancial(value, ENGINE_PRECISION);

/** Round to whole rupees — used for the grand total. */
export const toRupees = (value: number): number => roundFinancial(value, 0);

/**
 * Coerce arbitrary form input to a finite number. Empty strings, `null` and
 * `NaN` all collapse to 0 so a half-typed cell never poisons the totals.
 */
export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return fallback;
    // Tolerate grouped input such as "6,07,354" pasted from Excel.
    const parsed = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/** Percentage of a base, e.g. `percentOf(43095, 18) === 7757.1`. */
export const percentOf = (base: number, percent: number): number =>
  toEnginePrecision((base * percent) / 100);
