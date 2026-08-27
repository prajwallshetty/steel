import type { Metadata } from "next";
import { Role } from "@prisma/client";
import { Building2, Users } from "lucide-react";
import { requirePermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import { listVendors } from "@/modules/vendors/vendor-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";
import { VendorDialog } from "@/components/vendors/VendorDialog";
import { VendorRowActions } from "@/components/vendors/VendorRowActions";

import { getActiveBranchFilter } from "@/modules/branches/branch-context";

export const metadata: Metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function VendorsPage({ searchParams }: PageProps) {
  const user = await requirePermission(PERMISSIONS.CUSTOMER_VIEW);
  const params = await searchParams;

  const activeBranchId = await getActiveBranchFilter(user, params.branchId);
  const isSuper = user.role === Role.SUPER_ADMIN;

  const [vendors, branches] = await Promise.all([
    listVendors(user, { search: params.search, branchId: activeBranchId }),
    isSuper ? listSelectableBranches(user) : Promise.resolve([]),
  ]);

  const canCreate = hasPermission(user, PERMISSIONS.CUSTOMER_CREATE);
  const canUpdate = hasPermission(user, PERMISSIONS.CUSTOMER_UPDATE);
  const canDelete = hasPermission(user, PERMISSIONS.CUSTOMER_DELETE);

  const branchOptions = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
  }));

  const totalLiability = vendors.reduce((acc, v) => acc + (v.balance || 0), 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Vendors"
        description={`${vendors.length} ${vendors.length === 1 ? "vendor" : "vendors"} in your scope · Total Liability: ${totalLiability < 0 ? `-₹${Math.abs(totalLiability).toLocaleString("en-IN")}` : `₹${totalLiability.toLocaleString("en-IN")}`}`}
        actions={
          canCreate ? (
            <VendorDialog
              branches={branchOptions}
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
                placeholder: "Name, phone, GSTIN…",
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

      {vendors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Building2 className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No vendors yet</p>
              <p className="text-sm text-muted-foreground">
                Add a vendor to link purchase and expense payments.
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
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Vendor Name</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Amount / Balance</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">GSTIN</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">City / state</th>
                  {isSuper && (
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Branch</th>
                  )}
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">{vendor.name}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${vendor.balance < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {vendor.balance < 0 ? `-₹${Math.abs(vendor.balance).toLocaleString("en-IN")}` : `₹${vendor.balance.toLocaleString("en-IN")}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {vendor.phone ?? "—"}
                      {vendor.email && (
                        <span className="block text-xs">{vendor.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {vendor.gstNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[vendor.city, vendor.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    {isSuper && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {vendor.branchName}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <VendorDialog
                            vendor={{
                              id: vendor.id,
                              name: vendor.name,
                              phone: vendor.phone ?? "",
                              email: vendor.email ?? "",
                              gstNumber: vendor.gstNumber ?? "",
                              address: vendor.address ?? "",
                              city: vendor.city ?? "",
                              state: vendor.state ?? "",
                              pin: vendor.pin ?? "",
                              balance: vendor.balance,
                              branchId: vendor.branchId,
                            }}
                            branches={branchOptions}
                            canSelectBranch={false}
                            defaultBranchId={vendor.branchId}
                          />
                        )}
                        {canDelete && (
                          <VendorRowActions
                            id={vendor.id}
                            name={vendor.name}
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
