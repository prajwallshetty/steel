import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";
import { quotationRepository, settingsRepository } from "@/lib/repository";
import { calculateQuotation } from "@/lib/quotation-engine";
import { formatListDate, formatMoney, formatQuantity } from "@/lib/format/number";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Quotations" };

/** Always read through to the store — quotations change on every save. */
export const dynamic = "force-dynamic";

export default async function QuotationsPage() {
  const [quotations, settings] = await Promise.all([
    quotationRepository.list(),
    settingsRepository.get(),
  ]);

  const rows = quotations.map((quotation) =>
    calculateQuotation(quotation, settings),
  );
  const grouping = settings.display.numberGrouping;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotations</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "quotation" : "quotations"} on
            record.
          </p>
        </div>
        <Button render={<Link href="/quotations/new" />}>
          <Plus />
          New quotation
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No quotations yet</p>
              <p className="text-sm text-muted-foreground">
                Create one to get started.
              </p>
            </div>
            <Button render={<Link href="/quotations/new" />}>
              <Plus />
              New quotation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Reference
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Party
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Brand / location
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Qty (MT)
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Grand total
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((quotation) => (
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
                    <td className="px-4 py-3">{quotation.header.partyName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {quotation.header.brand} · {quotation.header.location}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatListDate(quotation.header.date)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatQuantity(quotation.totals.totalQuantity)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatMoney(quotation.totals.grandTotal, grouping)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          quotation.status === "finalized"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {quotation.status === "finalized"
                          ? "Finalized"
                          : "Draft"}
                      </Badge>
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
