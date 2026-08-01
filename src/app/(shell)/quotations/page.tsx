import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";
import { QuotationStatus } from "@prisma/client";
import { requireAnyPermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import { listQuotations } from "@/modules/quotations/quotation-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { getSettings } from "@/modules/settings/settings-service";
import { formatListDate, formatMoney, formatQuantity } from "@/lib/format/number";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";

export const metadata: Metadata = { title: "Quotations" };
export const dynamic = "force-dynamic";

const VIEW_PERMISSIONS = [
  PERMISSIONS.QUOTATION_VIEW_ALL,
  PERMISSIONS.QUOTATION_VIEW_BRANCH,
  PERMISSIONS.QUOTATION_VIEW_OWN,
] as const;

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function QuotationsPage({ searchParams }: PageProps) {
  const user = await requireAnyPermission(VIEW_PERMISSIONS);
  const params = await searchParams;

  const canSeeAllBranches = hasPermission(user, PERMISSIONS.QUOTATION_VIEW_ALL);

  const [{ items, total }, settings, branches] = await Promise.all([
    listQuotations(user, {
      search: params.search,
      status: params.status as QuotationStatus | undefined,
      branchId: params.branchId,
      from: params.from,
      to: params.to,
      take: 100,
    }),
    getSettings(user.branchId),
    canSeeAllBranches ? listSelectableBranches(user) : Promise.resolve([]),
  ]);

  const grouping = settings.display.numberGrouping;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Quotations"
        description={`${total} ${total === 1 ? "quotation" : "quotations"} in your scope.`}
        actions={
          hasPermission(user, PERMISSIONS.QUOTATION_CREATE) ? (
            <Button render={<Link href="/quotations/new" />}>
              <Plus />
              New quotation
            </Button>
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
                placeholder: "Reference, party, brand…",
              },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: Object.values(QuotationStatus).map((status) => ({
                  value: status,
                  label: status.replace(/_/g, " ").toLowerCase(),
                })),
              },
              ...(canSeeAllBranches
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
              { key: "from", label: "From", type: "date" },
              { key: "to", label: "To", type: "date" },
            ]}
          />
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No quotations found</p>
              <p className="text-sm text-muted-foreground">
                Try clearing the filters, or create a new quotation.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Reference</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Party</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Brand / location</th>
                  {canSeeAllBranches && (
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Branch</th>
                  )}
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Date</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Qty (MT)</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Grand total</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((quotation) => (
                  <tr
                    key={quotation.id}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/quotations/${quotation.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {quotation.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{quotation.partyName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {quotation.brand} · {quotation.location}
                    </td>
                    {canSeeAllBranches && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {quotation.branchName}
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatListDate(quotation.quotationDate)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatQuantity(quotation.totalQuantity)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatMoney(quotation.grandTotal, grouping)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={quotation.status} />
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
