import { Role } from "@prisma/client";

/**
 * The permission catalogue.
 *
 * Permissions are capabilities, not screens: a route may require several, and
 * the same permission may gate a server action, a nav item and an API path.
 * They are plain string literals so they can be stored on a User row and
 * checked without a database join.
 */
export const PERMISSIONS = {
  // Branches
  BRANCH_VIEW_ALL: "branch:view_all",
  BRANCH_VIEW: "branch:view",
  BRANCH_CREATE: "branch:create",
  BRANCH_UPDATE: "branch:update",
  BRANCH_ARCHIVE: "branch:archive",

  // Users
  USER_VIEW_ALL: "user:view_all",
  USER_VIEW: "user:view",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",
  USER_DISABLE: "user:disable",
  USER_RESET_PASSWORD: "user:reset_password",
  USER_MANAGE_PERMISSIONS: "user:manage_permissions",

  // Customers
  CUSTOMER_VIEW: "customer:view",
  CUSTOMER_CREATE: "customer:create",
  CUSTOMER_UPDATE: "customer:update",
  CUSTOMER_DELETE: "customer:delete",

  // Quotations
  QUOTATION_VIEW_ALL: "quotation:view_all",
  QUOTATION_VIEW_BRANCH: "quotation:view_branch",
  QUOTATION_VIEW_OWN: "quotation:view_own",
  QUOTATION_CREATE: "quotation:create",
  QUOTATION_UPDATE_ANY: "quotation:update_any",
  QUOTATION_UPDATE_OWN: "quotation:update_own",
  QUOTATION_DELETE: "quotation:delete",
  QUOTATION_APPROVE: "quotation:approve",
  QUOTATION_ASSIGN: "quotation:assign",

  // Cash ledger
  LEDGER_VIEW_ALL: "ledger:view_all",
  LEDGER_VIEW_BRANCH: "ledger:view_branch",
  LEDGER_VIEW_OWN: "ledger:view_own",
  LEDGER_CREATE: "ledger:create",
  LEDGER_UPDATE_ANY: "ledger:update_any",
  LEDGER_UPDATE_OWN: "ledger:update_own",
  LEDGER_DELETE: "ledger:delete",
  LEDGER_APPROVE: "ledger:approve",

  // Reports
  REPORT_VIEW_ALL: "report:view_all",
  REPORT_VIEW_BRANCH: "report:view_branch",
  REPORT_VIEW_OWN: "report:view_own",
  REPORT_EXPORT: "report:export",

  // System
  SETTINGS_MANAGE: "settings:manage",
  AUDIT_VIEW: "audit:view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

/**
 * Baseline capabilities per role.
 *
 * SUPER_ADMIN is intentionally absent: it is handled as an unconditional allow
 * in `hasPermission`, so a permission added to the catalogue tomorrow cannot
 * accidentally be withheld from the account that is supposed to have
 * everything.
 */
const ROLE_PERMISSIONS: Record<
  Exclude<Role, "SUPER_ADMIN">,
  readonly Permission[]
> = {
  BRANCH_ADMIN: [
    PERMISSIONS.BRANCH_VIEW,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DISABLE,
    PERMISSIONS.USER_RESET_PASSWORD,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.CUSTOMER_DELETE,
    PERMISSIONS.QUOTATION_VIEW_BRANCH,
    PERMISSIONS.QUOTATION_VIEW_OWN,
    PERMISSIONS.QUOTATION_CREATE,
    PERMISSIONS.QUOTATION_UPDATE_ANY,
    PERMISSIONS.QUOTATION_UPDATE_OWN,
    PERMISSIONS.QUOTATION_DELETE,
    PERMISSIONS.QUOTATION_APPROVE,
    PERMISSIONS.QUOTATION_ASSIGN,
    PERMISSIONS.LEDGER_VIEW_BRANCH,
    PERMISSIONS.LEDGER_VIEW_OWN,
    PERMISSIONS.LEDGER_CREATE,
    PERMISSIONS.LEDGER_UPDATE_ANY,
    PERMISSIONS.LEDGER_UPDATE_OWN,
    PERMISSIONS.LEDGER_DELETE,
    PERMISSIONS.LEDGER_APPROVE,
    PERMISSIONS.REPORT_VIEW_BRANCH,
    PERMISSIONS.REPORT_VIEW_OWN,
    PERMISSIONS.REPORT_EXPORT,
  ],
  MANAGER: [
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.QUOTATION_VIEW_OWN,
    PERMISSIONS.QUOTATION_CREATE,
    PERMISSIONS.QUOTATION_UPDATE_OWN,
    PERMISSIONS.LEDGER_VIEW_OWN,
    PERMISSIONS.LEDGER_CREATE,
    PERMISSIONS.LEDGER_UPDATE_OWN,
    PERMISSIONS.REPORT_VIEW_OWN,
  ],
};

/** The permissions a role grants before per-user grants and denials. */
export function permissionsForRole(role: Role): readonly Permission[] {
  return role === Role.SUPER_ADMIN
    ? ALL_PERMISSIONS
    : ROLE_PERMISSIONS[role];
}

export interface PermissionSubject {
  readonly role: Role;
  readonly extraPermissions: readonly string[];
  readonly deniedPermissions: readonly string[];
}

/**
 * Resolve the effective permission set: role baseline, plus per-user grants,
 * minus per-user denials.
 *
 * SUPER_ADMIN short-circuits — the brief states it "cannot be restricted", so
 * a denial list on that account is ignored rather than honoured. Without this,
 * a mis-set denial could lock every administrator out of the system.
 */
export function effectivePermissions(
  subject: PermissionSubject,
): ReadonlySet<Permission> {
  if (subject.role === Role.SUPER_ADMIN) return new Set(ALL_PERMISSIONS);

  const granted = new Set<Permission>(permissionsForRole(subject.role));

  for (const extra of subject.extraPermissions) {
    if (isPermission(extra)) granted.add(extra);
  }
  for (const denied of subject.deniedPermissions) {
    if (isPermission(denied)) granted.delete(denied);
  }

  return granted;
}

export function hasPermission(
  subject: PermissionSubject,
  permission: Permission,
): boolean {
  if (subject.role === Role.SUPER_ADMIN) return true;
  return effectivePermissions(subject).has(permission);
}

export function hasAnyPermission(
  subject: PermissionSubject,
  permissions: readonly Permission[],
): boolean {
  if (subject.role === Role.SUPER_ADMIN) return true;
  const granted = effectivePermissions(subject);
  return permissions.some((permission) => granted.has(permission));
}

/** Narrow an arbitrary string to a known permission key. */
export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  BRANCH_ADMIN: "Branch Admin",
  MANAGER: "Manager",
};
