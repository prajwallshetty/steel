import type { Metadata } from "next";
import { Role } from "@prisma/client";
import { requireAnyPermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import { listBranches } from "@/modules/branches/branch-service";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeading } from "@/components/layout/PageHeading";
import { BranchDialog } from "@/components/branches/BranchDialog";
import { ArchiveBranchButton } from "@/components/branches/ArchiveBranchButton";

export const metadata: Metadata = { title: "Branches" };
export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const user = await requireAnyPermission([
    PERMISSIONS.BRANCH_VIEW_ALL,
    PERMISSIONS.BRANCH_VIEW,
  ]);

  const isSuper = user.role === Role.SUPER_ADMIN;
  const branches = await listBranches(user, { includeArchived: isSuper });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Branches"
        description={
          isSuper
            ? "Every branch in the organisation. Add as many as you need — nothing in the system is hardcoded to a fixed set."
            : "Your branch details."
        }
        actions={
          hasPermission(user, PERMISSIONS.BRANCH_CREATE) ? (
            <BranchDialog canEditCode />
          ) : undefined
        }
      />

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 text-left font-semibold">Code</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Name</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">State</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">GSTIN</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Contact</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Users</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Quotations</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr
                  key={branch.id}
                  className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold">
                    {branch.code}
                  </td>
                  <td className="px-4 py-3 font-medium">{branch.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{branch.state}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {branch.gstNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {branch.phone ?? "—"}
                    {branch.email && <span className="block">{branch.email}</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {branch.userCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {branch.quotationCount}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={branch.status} kind="generic" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {hasPermission(user, PERMISSIONS.BRANCH_UPDATE) && (
                        <BranchDialog
                          canEditCode={isSuper}
                          branch={{
                            id: branch.id,
                            code: branch.code,
                            name: branch.name,
                            state: branch.state,
                            gstNumber: branch.gstNumber ?? "",
                            address: branch.address ?? "",
                            phone: branch.phone ?? "",
                            email: branch.email ?? "",
                            logoUrl: "",
                            status: branch.status,
                          }}
                        />
                      )}
                      {hasPermission(user, PERMISSIONS.BRANCH_ARCHIVE) &&
                        branch.status !== "ARCHIVED" && (
                          <ArchiveBranchButton
                            id={branch.id}
                            name={branch.name}
                            userCount={branch.userCount}
                          />
                        )}
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
