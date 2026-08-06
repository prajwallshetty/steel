import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Plus, CheckCircle, Clock, FileEdit, Scale, IndianRupee } from "lucide-react";
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-l-4 border-l-primary/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Listed</p>
              <p className="text-xl font-extrabold text-foreground mt-0.5">{items.length}</p>
            </div>
            <FileText className="size-5 text-primary/60 shrink-0" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-card to-indigo-500/5 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scope weight (MT)</p>
              <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1 select-none">
                <Scale className="size-4" />
                {formatQuantity(items.reduce((acc, q) => acc + q.totalQuantity, 0))}
              </p>
            </div>
            <IndianRupee className="size-5 text-indigo-500/60 shrink-0" />
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
                placeholder: "Reference, party, brand…",
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
        <Card className="overflow-hidden py-0 border border-border/80 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Reference</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Party</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Brand / Location</th>
                  {canSeeAllBranches && (
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Branch</th>
                  )}
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Date</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Qty (MT)</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Grand Total</th>

                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((quotation) => (
                  <tr
                    key={quotation.id}
                    className="group border-b transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-semibold text-primary">
                      <Link
                        href={`/quotations/${quotation.id}`}
                        className="hover:underline"
                      >
                        {quotation.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{quotation.partyName}</td>
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
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatQuantity(quotation.totalQuantity)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground tabular-nums">
                      {formatMoney(quotation.grandTotal, grouping)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="xs"
                        className="opacity-0 group-hover:opacity-100 group-hover:bg-accent/80 transition-all font-semibold"
                        render={<Link href={`/quotations/${quotation.id}`} />}
                      >
                        View
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
