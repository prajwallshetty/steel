import { percentOf, toEnginePrecision } from "./money";

/**
 * Cash-discount amount for a base value.
 *
 * Returned as a positive magnitude; callers subtract it. Keeping the sign out
 * of the engine means a future "surcharge" rule can reuse the same primitive.
 */
export function calculateDiscount(base: number, discountPercent: number): number {
  if (discountPercent === 0 || base === 0) return 0;
  return percentOf(base, discountPercent);
}

/** Apply a discount to a base, never letting the result go below zero. */
export function applyDiscount(base: number, discountAmount: number): number {
  return toEnginePrecision(Math.max(0, base - discountAmount));
}
