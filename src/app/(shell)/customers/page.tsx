import type { Metadata } from "next";
import Link from "next/link";
import { Role } from "@prisma/client";
import { Users, FileText } from "lucide-react";
import { requirePermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import { listCustomers } from "@/modules/customers/customer-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { CustomerRowActions } from "@/components/customers/CustomerRowActions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const user = await requirePermission(PERMISSIONS.CUSTOMER_VIEW);
  const params = await searchParams;

  const isSuper = user.role === Role.SUPER_ADMIN;

  const [customers, branches] = await Promise.all([
    listCustomers(user, { search: params.search, branchId: params.branchId }),
    isSuper ? listSelectableBranches(user) : Promise.resolve([]),
  ]);

  const canCreate = hasPermission(user, PERMISSIONS.CUSTOMER_CREATE);
  const canUpdate = hasPermission(user, PERMISSIONS.CUSTOMER_UPDATE);
  const canDelete = hasPermission(user, PERMISSIONS.CUSTOMER_DELETE);

  const branchOptions = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Customers"
        description={`${customers.length} ${customers.length === 1 ? "customer" : "customers"} in your scope.`}
        actions={
          canCreate ? (
            <CustomerDialog
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

      {customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No customers yet</p>
              <p className="text-sm text-muted-foreground">
                Add a customer so quotations can be linked to them.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">GSTIN</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">City / state</th>
                  {isSuper && (
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Branch</th>
                  )}
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Quotations</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium">{customer.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {customer.phone ?? "—"}
                      {customer.email && (
                        <span className="block text-xs">{customer.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {customer.gstNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[customer.city, customer.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    {isSuper && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {customer.branchName}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {customer.quotationCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          render={<Link href={`/ledger?customerId=${customer.id}`} />}
                          title="View Ledger"
                          aria-label="View Ledger"
                          className="size-8 text-muted-foreground hover:text-foreground animate-none transition-all duration-150"
                        >
                          <FileText className="size-4" />
                        </Button>
                        {canUpdate && (
                          <CustomerDialog
                            customer={{
                              id: customer.id,
                              name: customer.name,
                              phone: customer.phone ?? "",
                              email: customer.email ?? "",
                              gstNumber: customer.gstNumber ?? "",
                              address: "",
                              city: customer.city ?? "",
                              state: customer.state ?? "",
                              pin: "",
                              branchId: customer.branchId,
                            }}
                            branches={branchOptions}
                            canSelectBranch={false}
                            defaultBranchId={customer.branchId}
                          />
                        )}
                        {canDelete && (
                          <CustomerRowActions
                            id={customer.id}
                            name={customer.name}
                            quotationCount={customer.quotationCount}
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
