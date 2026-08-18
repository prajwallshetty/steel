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

export const metadata: Metadata = { title: "Divisions" };
export const dynamic = "force-dynamic";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

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
        title="Divisions"
        description={
          isSuper
            ? "Manage all divisions in the organisation. Configure starting balances, track cash in hand, and view division-wise daily closing balances."
            : "Your division details."
        }
        actions={
          hasPermission(user, PERMISSIONS.BRANCH_CREATE) ? (
            <BranchDialog canEditCode />
          ) : undefined
        }
      />

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 text-left font-semibold">Code</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Division Name</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">State</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Starting Bal.</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Closing Bal.</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Cash in Hand</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Users</th>
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
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                    {formatCurrency(branch.startingBalance)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(branch.closingBalance)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-blue-600 dark:text-blue-400">
                    {formatCurrency(branch.cashInHand)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {branch.userCount}
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
                            startingBalance: branch.startingBalance,
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
