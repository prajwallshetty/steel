import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  effectivePermissions,
  hasAnyPermission,
  hasPermission,
  permissionsForRole,
} from "./permissions";
import {
  assertBranchAccess,
  branchWhere,
  canMutateRecord,
  ForbiddenError,
  ledgerScope,
  ledgerWhere,
  quotationScope,
  quotationWhere,
  resolveWriteBranch,
  type ScopeSubject,
} from "./scope";

/**
 * RBAC is the security boundary of the whole ERP, so it is tested directly
 * rather than only through the screens that happen to use it.
 */

const superAdmin: ScopeSubject = {
  id: "u-super",
  role: Role.SUPER_ADMIN,
  branchId: null,
  extraPermissions: [],
  deniedPermissions: [],
};

const mangaloreAdmin: ScopeSubject = {
  id: "u-mng-admin",
  role: Role.BRANCH_ADMIN,
  branchId: "b-mng",
  extraPermissions: [],
  deniedPermissions: [],
};

const mangaloreManager: ScopeSubject = {
  id: "u-mng-mgr",
  role: Role.MANAGER,
  branchId: "b-mng",
  extraPermissions: [],
  deniedPermissions: [],
};

const maharashtraAdmin: ScopeSubject = {
  ...mangaloreAdmin,
  id: "u-mah-admin",
  branchId: "b-mah",
};

describe("role baselines", () => {
  it("gives Super Admin every permission in the catalogue", () => {
    expect(permissionsForRole(Role.SUPER_ADMIN)).toEqual(ALL_PERMISSIONS);
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission(superAdmin, permission)).toBe(true);
    }
  });

  it("never lets a Super Admin be restricted", () => {
    // The brief states the role "cannot be restricted"; a denial list must be
    // ignored rather than honoured, or a mis-set flag locks out the org.
    const hobbled: ScopeSubject = {
      ...superAdmin,
      deniedPermissions: [...ALL_PERMISSIONS],
    };
    expect(hasPermission(hobbled, PERMISSIONS.BRANCH_CREATE)).toBe(true);
    expect(effectivePermissions(hobbled).size).toBe(ALL_PERMISSIONS.length);
  });

  it("withholds branch and user creation from a branch admin", () => {
    expect(hasPermission(mangaloreAdmin, PERMISSIONS.BRANCH_CREATE)).toBe(false);
    expect(hasPermission(mangaloreAdmin, PERMISSIONS.BRANCH_ARCHIVE)).toBe(false);
    expect(hasPermission(mangaloreAdmin, PERMISSIONS.AUDIT_VIEW)).toBe(false);
    expect(hasPermission(mangaloreAdmin, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    // But they do run their own branch.
    expect(hasPermission(mangaloreAdmin, PERMISSIONS.USER_CREATE)).toBe(true);
    expect(hasPermission(mangaloreAdmin, PERMISSIONS.QUOTATION_APPROVE)).toBe(true);
  });

  it("restricts a manager to their branch and no administration", () => {
    expect(hasPermission(mangaloreManager, PERMISSIONS.QUOTATION_CREATE)).toBe(true);
    expect(hasPermission(mangaloreManager, PERMISSIONS.QUOTATION_VIEW_OWN)).toBe(true);
    expect(hasPermission(mangaloreManager, PERMISSIONS.QUOTATION_VIEW_BRANCH)).toBe(true);

    expect(hasPermission(mangaloreManager, PERMISSIONS.QUOTATION_APPROVE)).toBe(false);
    expect(hasPermission(mangaloreManager, PERMISSIONS.QUOTATION_DELETE)).toBe(false);
    expect(hasPermission(mangaloreManager, PERMISSIONS.USER_CREATE)).toBe(false);
    expect(hasPermission(mangaloreManager, PERMISSIONS.AUDIT_VIEW)).toBe(false);
    expect(hasPermission(mangaloreManager, PERMISSIONS.LEDGER_APPROVE)).toBe(false);
  });

  it("applies per-user grants and denials over the role baseline", () => {
    const promoted: ScopeSubject = {
      ...mangaloreManager,
      extraPermissions: [PERMISSIONS.QUOTATION_VIEW_BRANCH],
    };
    expect(hasPermission(promoted, PERMISSIONS.QUOTATION_VIEW_BRANCH)).toBe(true);

    const curtailed: ScopeSubject = {
      ...mangaloreAdmin,
      deniedPermissions: [PERMISSIONS.QUOTATION_APPROVE],
    };
    expect(hasPermission(curtailed, PERMISSIONS.QUOTATION_APPROVE)).toBe(false);
  });

  it("ignores unknown permission strings rather than trusting them", () => {
    const forged: ScopeSubject = {
      ...mangaloreManager,
      extraPermissions: ["branch:delete_everything", "*"],
    };
    expect(effectivePermissions(forged).size).toBe(
      permissionsForRole(Role.MANAGER).length,
    );
  });

  it("treats hasAnyPermission as a true OR", () => {
    expect(
      hasAnyPermission(mangaloreManager, [
        PERMISSIONS.QUOTATION_VIEW_ALL,
        PERMISSIONS.QUOTATION_VIEW_OWN,
      ]),
    ).toBe(true);
    expect(
      hasAnyPermission(mangaloreManager, [
        PERMISSIONS.QUOTATION_VIEW_ALL,
        PERMISSIONS.AUDIT_VIEW,
      ]),
    ).toBe(false);
  });
});

describe("data scoping", () => {
  it("gives Super Admin an unfiltered scope", () => {
    expect(quotationScope(superAdmin)).toEqual({ kind: "all" });
    expect(quotationWhere(quotationScope(superAdmin))).toEqual({});
  });

  it("pins a branch admin to their own branch", () => {
    expect(quotationWhere(quotationScope(mangaloreAdmin))).toEqual({
      branchId: "b-mng",
    });
    expect(quotationWhere(quotationScope(maharashtraAdmin))).toEqual({
      branchId: "b-mah",
    });
  });

  it("pins a manager to their branch scope", () => {
    expect(quotationWhere(quotationScope(mangaloreManager))).toEqual({
      branchId: "b-mng",
    });
    expect(ledgerWhere(ledgerScope(mangaloreManager))).toEqual({
      branchId: "b-mng",
    });
  });

  it("returns a filter that matches nothing when no scope applies", () => {
    // An empty `where` in Prisma matches EVERY row, so a missed case here would
    // leak the whole table. The impossible filter is what prevents that.
    const stranded: ScopeSubject = {
      ...mangaloreManager,
      deniedPermissions: [
        PERMISSIONS.QUOTATION_VIEW_OWN,
        PERMISSIONS.QUOTATION_VIEW_BRANCH,
        PERMISSIONS.QUOTATION_VIEW_ALL,
      ],
    };
    const where = quotationWhere(quotationScope(stranded));
    expect(where).not.toEqual({});
    expect(where).toEqual({ id: "__no_access__" });
  });

  it("denies a branchless non-super account everything", () => {
    const misconfigured: ScopeSubject = { ...mangaloreAdmin, branchId: null };
    expect(quotationScope(misconfigured)).toEqual({ kind: "none" });
    expect(branchWhere(misconfigured)).toEqual({ id: "__no_access__" });
  });
});

describe("cross-branch write protection", () => {
  it("refuses a branch admin access to another branch", () => {
    expect(() => assertBranchAccess(mangaloreAdmin, "b-mah")).toThrow(
      ForbiddenError,
    );
    expect(() => assertBranchAccess(mangaloreAdmin, "b-mng")).not.toThrow();
    expect(() => assertBranchAccess(superAdmin, "b-mah")).not.toThrow();
  });

  it("ignores a forged branchId on a write and uses the session's", () => {
    // The core defence against a tampered form post.
    expect(resolveWriteBranch(mangaloreManager, null)).toBe("b-mng");
    expect(resolveWriteBranch(mangaloreManager, "b-mng")).toBe("b-mng");
    expect(() => resolveWriteBranch(mangaloreManager, "b-mah")).toThrow(
      ForbiddenError,
    );
  });

  it("requires Super Admin to name a branch explicitly", () => {
    expect(resolveWriteBranch(superAdmin, "b-mah")).toBe("b-mah");
    expect(() => resolveWriteBranch(superAdmin, null)).toThrow(ForbiddenError);
  });
});

describe("record-level mutation checks", () => {
  const own = { branchId: "b-mng", ownerIds: ["u-mng-mgr"] };
  const colleague = { branchId: "b-mng", ownerIds: ["u-other"] };
  const otherBranch = { branchId: "b-mah", ownerIds: ["u-mng-mgr"] };

  it("lets a manager change records in their branch", () => {
    const scope = quotationScope(mangaloreManager);
    expect(canMutateRecord(scope, own)).toBe(true);
    expect(canMutateRecord(scope, colleague)).toBe(true);
    expect(canMutateRecord(scope, otherBranch)).toBe(false);
  });

  it("lets a branch admin change anything in their branch but nothing outside", () => {
    const scope = quotationScope(mangaloreAdmin);
    expect(canMutateRecord(scope, own)).toBe(true);
    expect(canMutateRecord(scope, colleague)).toBe(true);
    expect(canMutateRecord(scope, otherBranch)).toBe(false);
  });

  it("lets a Super Admin change anything", () => {
    const scope = quotationScope(superAdmin);
    expect(canMutateRecord(scope, own)).toBe(true);
    expect(canMutateRecord(scope, otherBranch)).toBe(true);
  });

  it("denies a record with no applicable scope", () => {
    expect(canMutateRecord({ kind: "none" }, own)).toBe(false);
  });
});
