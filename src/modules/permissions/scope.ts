import { Role } from "@prisma/client";
import { PERMISSIONS, hasPermission, type PermissionSubject } from "./permissions";

/**
 * Data visibility scoping.
 *
 * Permissions answer "may this user perform this action?". Scope answers "over
 * which rows?" — and it is the half that actually enforces tenancy. Every
 * scoped read composes its `where` clause from here, so a branch admin cannot
 * observe another branch and a manager cannot observe a colleague's records,
 * regardless of what the request body claims.
 *
 * Scope is always derived from the session on the server. Nothing in this file
 * reads client input.
 */

export type AccessScope =
  /** Super Admin: the whole organisation. */
  | { readonly kind: "all" }
  /** Branch Admin: one branch, in full. */
  | { readonly kind: "branch"; readonly branchId: string }
  /** Manager: one branch, own records only. */
  | { readonly kind: "own"; readonly branchId: string; readonly userId: string }
  /** A user with no applicable permission — matches nothing. */
  | { readonly kind: "none" };

export interface ScopeSubject extends PermissionSubject {
  readonly id: string;
  readonly branchId: string | null;
}

/** Thrown when a request targets data outside the caller's scope. */
export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Pick the widest scope the subject is entitled to for a resource, by testing
 * its all/branch/own permissions in descending order of breadth.
 */
function resolveScope(
  subject: ScopeSubject,
  permissions: {
    readonly all: Parameters<typeof hasPermission>[1];
    readonly branch: Parameters<typeof hasPermission>[1];
    readonly own: Parameters<typeof hasPermission>[1];
  },
): AccessScope {
  if (subject.role === Role.SUPER_ADMIN || hasPermission(subject, permissions.all)) {
    return { kind: "all" };
  }

  // Below organisation level, a branch is mandatory. A branch-less non-super
  // account is a misconfiguration; it must see nothing rather than everything.
  if (!subject.branchId) return { kind: "none" };

  if (hasPermission(subject, permissions.branch)) {
    return { kind: "branch", branchId: subject.branchId };
  }
  if (hasPermission(subject, permissions.own)) {
    return { kind: "own", branchId: subject.branchId, userId: subject.id };
  }
  return { kind: "none" };
}

export const quotationScope = (subject: ScopeSubject): AccessScope =>
  resolveScope(subject, {
    all: PERMISSIONS.QUOTATION_VIEW_ALL,
    branch: PERMISSIONS.QUOTATION_VIEW_BRANCH,
    own: PERMISSIONS.QUOTATION_VIEW_OWN,
  });

export const ledgerScope = (subject: ScopeSubject): AccessScope =>
  resolveScope(subject, {
    all: PERMISSIONS.LEDGER_VIEW_ALL,
    branch: PERMISSIONS.LEDGER_VIEW_BRANCH,
    own: PERMISSIONS.LEDGER_VIEW_OWN,
  });

export const reportScope = (subject: ScopeSubject): AccessScope =>
  resolveScope(subject, {
    all: PERMISSIONS.REPORT_VIEW_ALL,
    branch: PERMISSIONS.REPORT_VIEW_BRANCH,
    own: PERMISSIONS.REPORT_VIEW_OWN,
  });

/**
 * A `where` fragment that can never match a row.
 *
 * Used for the "none" scope. Returning an impossible filter rather than an
 * empty object is deliberate: an empty `where` in Prisma matches *everything*,
 * so a missed case here would leak the entire table.
 */
const MATCH_NOTHING = { id: "__no_access__" } as const;

/** Prisma `where` fragment for quotations under a scope. */
export function quotationWhere(scope: AccessScope) {
  switch (scope.kind) {
    case "all":
      return {};
    case "branch":
      return { branchId: scope.branchId };
    case "own":
      return {
        branchId: scope.branchId,
        OR: [{ createdById: scope.userId }, { assignedToId: scope.userId }],
      };
    case "none":
      return MATCH_NOTHING;
  }
}

/** Prisma `where` fragment for ledger entries under a scope. */
export function ledgerWhere(scope: AccessScope) {
  switch (scope.kind) {
    case "all":
      return {};
    case "branch":
      return { branchId: scope.branchId };
    case "own":
      return { branchId: scope.branchId, createdById: scope.userId };
    case "none":
      return MATCH_NOTHING;
  }
}

/**
 * Prisma `where` fragment for branch-partitioned records with no per-user
 * dimension — customers, users, notifications.
 *
 * Managers see their whole branch's customers rather than only the ones they
 * created: a quotation must be able to reference any customer of the branch,
 * and hiding them would make the picker unusable.
 */
export function branchWhere(subject: ScopeSubject) {
  if (subject.role === Role.SUPER_ADMIN) return {};
  if (!subject.branchId) return MATCH_NOTHING;
  return { branchId: subject.branchId };
}

/**
 * Assert that the subject may write to a branch.
 *
 * The guard that stops a manager from re-pointing a create/update at another
 * branch by editing the request payload.
 */
export function assertBranchAccess(
  subject: ScopeSubject,
  branchId: string,
): void {
  if (subject.role === Role.SUPER_ADMIN) return;
  if (subject.branchId && subject.branchId === branchId) return;
  throw new ForbiddenError("You do not have access to that branch.");
}

/**
 * The branch a write must be attributed to.
 *
 * Non-super users may never choose: the value is taken from their session, so
 * a forged `branchId` in a form post is ignored rather than trusted.
 */
export function resolveWriteBranch(
  subject: ScopeSubject,
  requestedBranchId?: string | null,
): string {
  if (subject.role === Role.SUPER_ADMIN) {
    if (!requestedBranchId) {
      throw new ForbiddenError("Select a branch for this record.");
    }
    return requestedBranchId;
  }

  if (!subject.branchId) {
    throw new ForbiddenError("Your account is not assigned to a branch.");
  }
  if (requestedBranchId && requestedBranchId !== subject.branchId) {
    throw new ForbiddenError("You do not have access to that branch.");
  }
  return subject.branchId;
}

/**
 * Whether a subject may act on a specific record they have already read.
 *
 * Read scoping already filters lists; this covers the mutation path, where a
 * record is fetched by id and must then be checked against the "own record"
 * rule before being modified.
 */
export function canMutateRecord(
  scope: AccessScope,
  record: { readonly branchId: string; readonly ownerIds: readonly (string | null)[] },
): boolean {
  switch (scope.kind) {
    case "all":
      return true;
    case "branch":
      return record.branchId === scope.branchId;
    case "own":
      return (
        record.branchId === scope.branchId &&
        record.ownerIds.includes(scope.userId)
      );
    case "none":
      return false;
  }
}
