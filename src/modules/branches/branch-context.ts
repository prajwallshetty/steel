"use server";

import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import type { ScopeSubject } from "@/modules/permissions/scope";

export const ACTIVE_BRANCH_COOKIE = "steel_active_branch";

/**
 * Resolve the active branch filter for queries.
 *
 * For non-Super Admin users, this ALWAYS returns subject.branchId (strict branch isolation).
 * For Super Admin users:
 *   - If searchParamBranchId is explicitly passed:
 *     - "ALL" or empty string => undefined (Consolidated view)
 *     - specific branchId => branchId
 *   - Else, falls back to the active branch cookie "steel_active_branch":
 *     - "ALL" or empty string => undefined (Consolidated view)
 *     - specific branchId => branchId
 */
export async function getActiveBranchFilter(
  subject: ScopeSubject,
  searchParamBranchId?: string | null,
): Promise<string | undefined> {
  if (subject.role !== Role.SUPER_ADMIN) {
    return subject.branchId ?? undefined;
  }

  // Super Admin branch selection override via query parameter
  if (searchParamBranchId !== undefined && searchParamBranchId !== null) {
    const trimmed = searchParamBranchId.trim();
    if (trimmed === "" || trimmed.toUpperCase() === "ALL") {
      return undefined;
    }
    return trimmed;
  }

  // Fallback to cookie preference for Super Admin
  const cookieStore = await cookies();
  const val = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value?.trim();
  if (!val || val.toUpperCase() === "ALL") {
    return undefined;
  }

  return val;
}

/** Set active branch cookie for Super Admin switcher. */
export async function setActiveBranchCookie(branchId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRANCH_COOKIE, branchId, {
    httpOnly: false, // Accessible to clientJS for quick UI updates
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}
