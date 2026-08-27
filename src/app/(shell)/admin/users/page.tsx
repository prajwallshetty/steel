import type { Metadata } from "next";
import { Role } from "@prisma/client";
import { requireAnyPermission } from "@/modules/auth/guard";
import { PERMISSIONS, ROLE_LABELS, hasPermission } from "@/modules/permissions/permissions";
import { listUsers } from "@/modules/users/user-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { formatTimestamp } from "@/lib/format/number";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";
import { UserDialog } from "@/components/users/UserDialog";
import { UserRowActions } from "@/components/users/UserRowActions";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

import { getActiveBranchFilter } from "@/modules/branches/branch-context";

export default async function UsersPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAnyPermission([
    PERMISSIONS.USER_VIEW_ALL,
    PERMISSIONS.USER_VIEW,
  ]);
  const params = await searchParams;

  const activeBranchId = await getActiveBranchFilter(user, params.branchId);
  const isSuper = user.role === Role.SUPER_ADMIN;

  const [users, branches] = await Promise.all([
    listUsers(user, { search: params.search, branchId: activeBranchId }),
    isSuper ? listSelectableBranches(user) : Promise.resolve([]),
  ]);

  /*
   * A branch admin may only create roles strictly below their own. Offering
   * SUPER_ADMIN in their picker would be a privilege-escalation path the
   * service would reject anyway.
   */
  const assignableRoles: readonly Role[] = isSuper
    ? [Role.SUPER_ADMIN, Role.BRANCH_ADMIN, Role.MANAGER]
    : [Role.MANAGER];

  const branchOptions = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Users"
        description={`${users.length} ${users.length === 1 ? "user" : "users"}${user.branchName ? ` in ${user.branchName}` : " across all branches"}.`}
        actions={
          hasPermission(user, PERMISSIONS.USER_CREATE) ? (
            <UserDialog
              branches={branchOptions}
              assignableRoles={assignableRoles}
              canSelectBranch={isSuper}
              defaultBranchId={user.branchId}
            />
          ) : undefined
        }
      />

      <Card>
        <CardContent className="py-4">
          <FilterBar
            fields={[
              {
                key: "search",
                label: "Search",
                type: "search",
                placeholder: "Name, username, email…",
              },
              ...(isSuper
                ? [
                    {
                      key: "branchId",
                      label: "Branch",
                      type: "select" as const,
                      options: branches.map((branch) => ({
                        value: branch.id,
                        label: branch.name,
                      })),
                    },
                  ]
                : []),
            ]}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 text-left font-semibold">Name</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Username</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Role</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Branch</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Contact</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Last sign-in</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr
                  key={row.id}
                  className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3 font-medium">
                    {row.name}
                    {row.id === user.id && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.username}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[row.role]}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.branchName ?? "All branches"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {row.email ?? "—"}
                    {row.phone && <span className="block">{row.phone}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {row.lastLoginAt ? formatTimestamp(row.lastLoginAt) : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} kind="generic" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {hasPermission(user, PERMISSIONS.USER_UPDATE) && (
                        <UserDialog
                          user={{
                            id: row.id,
                            name: row.name,
                            username: row.username,
                            email: row.email ?? "",
                            phone: row.phone ?? "",
                            role: row.role,
                            branchId: row.branchId ?? "",
                            status: row.status,
                          }}
                          branches={branchOptions}
                          assignableRoles={assignableRoles}
                          canSelectBranch={isSuper}
                          defaultBranchId={row.branchId}
                        />
                      )}
                      <UserRowActions
                        id={row.id}
                        name={row.name}
                        status={row.status}
                        isSelf={row.id === user.id}
                        canDisable={hasPermission(user, PERMISSIONS.USER_DISABLE)}
                        canReset={hasPermission(
                          user,
                          PERMISSIONS.USER_RESET_PASSWORD,
                        )}
                        canDelete={hasPermission(user, PERMISSIONS.USER_UPDATE)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
