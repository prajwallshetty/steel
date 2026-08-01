import type { NumberGrouping } from "@/types/settings";
import { roundFinancial } from "@/lib/quotation-engine/money";

/**
 * Presentation-layer formatting. Nothing here rounds for calculation purposes —
 * the engine has already produced the value; this only decides how it reads.
 */

const INDIAN_INTEGER = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const PLAIN_INTEGER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: false,
});

const QUANTITY = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const DECIMAL_2 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Money as it appears in a sheet cell: whole rupees, no symbol.
 *
 * Values are rounded half-away-from-zero rather than handed to `Intl`'s
 * half-to-even so a displayed line always matches what the engine committed.
 */
export function formatMoney(
  value: number,
  grouping: NumberGrouping = "indian",
): string {
  const rounded = roundFinancial(value, 0);
  const normalised = Object.is(rounded, -0) ? 0 : rounded;
  return grouping === "none"
    ? PLAIN_INTEGER.format(normalised)
    : INDIAN_INTEGER.format(normalised);
}

/** Money with paise, for audit panels rather than the sheet itself. */
export function formatMoneyPrecise(value: number): string {
  return DECIMAL_2.format(roundFinancial(value, 2));
}

/** Quantity in tonnes: `1.99`, `7.1`, `0` — trailing zeros trimmed. */
export function formatQuantity(value: number): string {
  return QUANTITY.format(roundFinancial(value, 2));
}

/** A percentage label such as `1.5%` or `18%`. */
export function formatPercent(value: number): string {
  return `${QUANTITY.format(roundFinancial(value, 2))}%`;
}

/** `2026-07-07` -> `07-07-2026`, matching the workbook's date cell. */
export function formatSheetDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
}

/** `2026-07-07` -> `7 Jul 2026`, for list screens. */
export function formatListDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

/** ISO timestamp -> `7 Jul 2026, 3:04 pm`. */
export function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}
