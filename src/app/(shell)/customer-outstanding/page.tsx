import type { Metadata } from "next";
import Link from "next/link";
import { Role } from "@prisma/client";
import { Users, FileText, ArrowRight, ArrowUpRight, TrendingUp, Wallet, Receipt } from "lucide-react";
import { requirePermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import { listCustomerOutstanding } from "@/modules/customer-outstanding/customer-outstanding-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { getSettings } from "@/modules/settings/settings-service";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";
import { Button } from "@/components/ui/button";
import { formatMoney, formatListDate } from "@/lib/format/number";

import { getActiveBranchFilter } from "@/modules/branches/branch-context";

export const metadata: Metadata = { title: "Customer Outstanding" };
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CustomerOutstandingPage({ searchParams }: PageProps) {
  const user = await requirePermission(PERMISSIONS.CUSTOMER_VIEW);
  const params = await searchParams;

  const activeBranchId = await getActiveBranchFilter(user, params.branchId);
  const isSuper = user.role === Role.SUPER_ADMIN;

  const [data, branches, settings] = await Promise.all([
    listCustomerOutstanding(user, {
      search: params.search,
      branchId: activeBranchId,
      from: params.from,
      to: params.to,
      sortBy: params.sortBy as any,
    }),
    isSuper ? listSelectableBranches(user) : Promise.resolve([]),
    getSettings(user.branchId),
  ]);

  const grouping = settings.display.numberGrouping;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Customer Outstanding"
        description="Real-time breakdown of billed amounts, actual customer payments, and outstanding balances."
        actions={
          <Button render={<Link href="/customer-payments" />}>
            <Wallet className="size-4" />
            Record Customer Payment
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">{data.totalCustomers}</p>
            </div>
            <Users className="size-5 text-primary/60 shrink-0" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-card to-blue-500/5 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Billed / Invoiced</p>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
                ₹{formatMoney(data.totalBilledSum, grouping)}
              </p>
            </div>
            <Receipt className="size-5 text-blue-500/60 shrink-0" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-card to-emerald-500/5 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Collected / Paid</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                ₹{formatMoney(data.totalPaidSum, grouping)}
              </p>
            </div>
            <Wallet className="size-5 text-emerald-500/60 shrink-0" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 bg-gradient-to-br from-card to-rose-500/5 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Outstanding Dues</p>
              <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
                ₹{formatMoney(data.totalOutstandingSum, grouping)}
              </p>
            </div>
            <TrendingUp className="size-5 text-rose-500/60 shrink-0" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <FilterBar
            fields={[
              {
                key: "search",
                label: "Search",
                type: "search",
                placeholder: "Customer name, city, phone…",
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
              {
                key: "sortBy",
                label: "Sort By",
                type: "select",
                options: [
                  { value: "highest_outstanding", label: "Highest Outstanding" },
                  { value: "oldest_outstanding", label: "Oldest Outstanding" },
                  { value: "billed", label: "Highest Billed" },
                  { value: "name", label: "Customer Name" },
                ],
              },
              { key: "from", label: "From", type: "date" },
              { key: "to", label: "To", type: "date" },
            ]}
          />
        </CardContent>
      </Card>

      {data.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No customer outstanding records found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filter parameters.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0 border border-border/80 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Customer Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Location</th>
                  {isSuper && (
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Branch</th>
                  )}
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Total Billed</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Total Paid</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Outstanding</th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold">Payment Status</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Last Payment</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Last Activity</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="group border-b transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <Link
                        href={`/ledger?customerId=${item.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {item.name}
                      </Link>
                      {item.phone && (
                        <span className="block text-xs text-muted-foreground font-normal">{item.phone}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.city ? `${item.city}${item.state ? `, ${item.state}` : ""}` : "—"}
                    </td>
                    {isSuper && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.branchName}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                      ₹{formatMoney(item.totalBilled, grouping)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      ₹{formatMoney(item.totalPaid, grouping)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${item.outstandingAmount > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                      ₹{formatMoney(item.outstandingAmount, grouping)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          item.paymentStatus === "Paid"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                            : item.paymentStatus === "Partially Paid"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {item.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-medium">
                      {item.lastPaymentDate ? formatListDate(item.lastPaymentDate) : "No payments"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-medium">
                      {item.lastTransactionDate ? formatListDate(item.lastTransactionDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="xs"
                        className="font-semibold hover:bg-accent"
                        render={<Link href={`/ledger?customerId=${item.id}`} />}
                      >
                        Ledger
                        <ArrowRight className="size-3.5" />
                      </Button>
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
