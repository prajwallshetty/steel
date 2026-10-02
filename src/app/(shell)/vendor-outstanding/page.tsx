import type { Metadata } from "next";
import Link from "next/link";
import { Role } from "@prisma/client";
import { Building2, TrendingUp, Wallet } from "lucide-react";
import { requirePermission } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import { listVendorOutstanding } from "@/modules/vendor-outstanding/vendor-outstanding-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { getSettings } from "@/modules/settings/settings-service";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format/number";
import { ExportButton } from "@/components/reports/ExportButton";
import { getActiveBranchFilter } from "@/modules/branches/branch-context";
import { VendorOutstandingClient } from "@/components/vendor-outstanding/VendorOutstandingClient";

export const metadata: Metadata = { title: "Vendor Outstanding" };
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function VendorOutstandingPage({ searchParams }: PageProps) {
  const user = await requirePermission(PERMISSIONS.CUSTOMER_VIEW);
  const params = await searchParams;

  const activeBranchId = await getActiveBranchFilter(user, params.branchId);
  const isSuper = user.role === Role.SUPER_ADMIN;

  const page = params.page ? parseInt(params.page, 10) : 1;
  const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 25;

  const [data, branches, settings] = await Promise.all([
    listVendorOutstanding(user, {
      search: params.search,
      branchId: activeBranchId,
      from: params.from,
      to: params.to,
      paymentStatus: params.paymentStatus as any,
      sortBy: params.sortBy as any,
      page,
      pageSize,
    }),
    isSuper ? listSelectableBranches(user) : Promise.resolve([]),
    getSettings(user.branchId),
  ]);

  const grouping = settings.display.numberGrouping;

  const exportQuery = new URLSearchParams({ kind: "vendor-outstanding" });
  if (params.search) exportQuery.set("search", params.search);
  if (params.from) exportQuery.set("from", params.from);
  if (params.to) exportQuery.set("to", params.to);
  if (params.paymentStatus) exportQuery.set("paymentStatus", params.paymentStatus);
  if (params.sortBy) exportQuery.set("sortBy", params.sortBy);
  if (activeBranchId) exportQuery.set("branchId", activeBranchId);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Vendor Outstanding"
        description="Real-time breakdown of vendor purchases, recorded vendor payments, and outstanding liabilities."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton href={`/api/reports/export?${exportQuery.toString()}&format=csv`} label="Export CSV" />
            <ExportButton href={`/api/reports/export?${exportQuery.toString()}&format=pdf`} label="Export PDF" />
            <Button render={<Link href="/vendor-payments" />}>
              <Wallet className="size-4" />
              Record Vendor Payment
            </Button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-l-4 border-l-primary/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Vendors</p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">{data.totalVendors}</p>
            </div>
            <Building2 className="size-5 text-primary/60 shrink-0" />
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
                placeholder: "Vendor name, city, phone…",
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
                  { value: "payable", label: "Highest Payable" },
                  { value: "name", label: "Vendor Name" },
                ],
              },
              { key: "from", label: "From", type: "date" },
              { key: "to", label: "To", type: "date" },
            ]}
          />
        </CardContent>
      </Card>

      <VendorOutstandingClient
        data={data}
        isSuper={isSuper}
        grouping={grouping}
      />
    </div>
  );
}
