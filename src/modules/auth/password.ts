import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * bcrypt at cost 12 — chosen over a bare SHA family because it is deliberately
 * slow and salts per-hash, so a stolen `users` table cannot be reversed with a
 * rainbow table.
 */
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Minimum password policy, shared by the create-user and reset-password paths.
 * Returns null when acceptable, otherwise the reason.
 */
export function validatePasswordStrength(plain: string): string | null {
  if (plain.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(plain)) return "Password must contain a lowercase letter.";
  if (!/[A-Z]/.test(plain)) return "Password must contain an uppercase letter.";
  if (!/[0-9]/.test(plain)) return "Password must contain a number.";
  return null;
}

/** A readable temporary password for admin-issued resets. */
export function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O — misread on paper
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string, count: number) =>
    Array.from(
      { length: count },
      () => set[Math.floor(Math.random() * set.length)],
    ).join("");
  return `${pick(upper, 2)}${pick(lower, 5)}${pick(digits, 3)}`;
}
