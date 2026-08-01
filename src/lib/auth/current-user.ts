/**
 * Identity seam.
 *
 * The brief does not specify an auth provider, so quotations are attributed to
 * a single operator. Swap this one function for a session lookup (NextAuth,
 * Clerk, a JWT header) and every audit field starts recording real users —
 * nothing else in the codebase reads the identity directly.
 */
export interface CurrentUser {
  readonly id: string;
  readonly name: string;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return { id: "operator", name: process.env.STEEL_OPERATOR ?? "Operator" };
}
