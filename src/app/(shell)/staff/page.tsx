import type { Metadata } from "next";
import { Role } from "@prisma/client";
import { Users } from "lucide-react";
import { requirePermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import { listStaff } from "@/modules/staff/staff-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";
import { StaffDialog } from "@/components/staff/StaffDialog";
import { StaffPaymentDialog } from "@/components/staff/StaffPaymentDialog";
import { StaffRowActions } from "@/components/staff/StaffRowActions";

import { getActiveBranchFilter } from "@/modules/branches/branch-context";

export const metadata: Metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function StaffPage({ searchParams }: PageProps) {
  const user = await requirePermission(PERMISSIONS.STAFF_VIEW);
  const params = await searchParams;

  const activeBranchId = await getActiveBranchFilter(user, params.branchId);
  const isSuper = user.role === Role.SUPER_ADMIN;

  const [staffMembers, branches] = await Promise.all([
    listStaff(user, { search: params.search, branchId: activeBranchId }),
    isSuper ? listSelectableBranches(user) : Promise.resolve([]),
  ]);

  const canCreate = hasPermission(user, PERMISSIONS.STAFF_CREATE);
  const canUpdate = hasPermission(user, PERMISSIONS.STAFF_UPDATE);
  const canDelete = hasPermission(user, PERMISSIONS.STAFF_DELETE);

  const branchOptions = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
  }));

  const staffOptions = staffMembers.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  const totalBalance = staffMembers.reduce((acc, s) => acc + (s.balance || 0), 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Staff"
        description={`${staffMembers.length} staff member${staffMembers.length === 1 ? "" : "s"} · Net Staff Balance: ${totalBalance < 0 ? `-₹${Math.abs(totalBalance).toLocaleString("en-IN")}` : `₹${totalBalance.toLocaleString("en-IN")}`}`}
        actions={
          canUpdate || canCreate ? (
            <StaffPaymentDialog staffList={staffOptions} />
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
                placeholder: "Name, designation, phone…",
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

      {staffMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No staff members found</p>
              <p className="text-sm text-muted-foreground">
                Add staff members to track staff payments and advances.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Staff Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Designation</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Amount / Balance</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Contact</th>
                  {isSuper && (
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Branch</th>
                  )}
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {staffMembers.map((staff) => (
                  <tr
                    key={staff.id}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">{staff.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{staff.designation ?? "Staff"}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${staff.balance < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {staff.balance < 0 ? `-₹${Math.abs(staff.balance).toLocaleString("en-IN")}` : `₹${staff.balance.toLocaleString("en-IN")}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {staff.phone ?? "—"}
                      {staff.email && (
                        <span className="block text-xs">{staff.email}</span>
                      )}
                    </td>
                    {isSuper && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {staff.branchName}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <StaffDialog
                            staff={{
                              id: staff.id,
                              name: staff.name,
                              phone: staff.phone ?? "",
                              email: staff.email ?? "",
                              designation: staff.designation ?? "",
                              address: staff.address ?? "",
                              balance: staff.balance,
                              branchId: staff.branchId,
                            }}
                            branches={branchOptions}
                            canSelectBranch={false}
                            defaultBranchId={staff.branchId}
                          />
                        )}
                        {canDelete && (
                          <StaffRowActions
                            id={staff.id}
                            name={staff.name}
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
      )}
    </div>
  );
}
