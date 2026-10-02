"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Building2,
  ArrowRight,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatListDate } from "@/lib/format/number";
import type { NumberGrouping } from "@/types/settings";
import type { VendorOutstandingSummary, VendorOutstandingPage } from "@/modules/vendor-outstanding/vendor-outstanding-service";
import { VendorDetailsDialog } from "./VendorDetailsDialog";

interface VendorOutstandingClientProps {
  readonly data: VendorOutstandingPage;
  readonly isSuper: boolean;
  readonly grouping?: NumberGrouping;
}

export function VendorOutstandingClient({
  data,
  isSuper,
  grouping,
}: VendorOutstandingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [selectedVendor, setSelectedVendor] = useState<VendorOutstandingSummary | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleOpenDetails = (vendor: VendorOutstandingSummary) => {
    setSelectedVendor(vendor);
    setDetailsOpen(true);
  };

  const setPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const setPageSize = (newSize: string | null) => {
    if (!newSize) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", newSize);
    params.set("page", "1");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const fromItem = data.totalVendors === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const toItem = Math.min(data.page * data.pageSize, data.totalVendors);

  return (
    <>
      {data.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Building2 className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No vendor outstanding records found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filter parameters.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0 border border-border/80 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Vendor Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Location</th>
                  {isSuper && (
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Branch</th>
                  )}
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Total Payable</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Total Paid</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Outstanding Dues</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Overdue Amount</th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Last Payment</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span>Actions</span>
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
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(item)}
                        className="text-left font-semibold hover:text-primary hover:underline"
                      >
                        {item.name}
                      </button>
                      {item.phone && (
                        <span className="block text-xs text-muted-foreground font-normal">{item.phone}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {item.city ? `${item.city}${item.state ? `, ${item.state}` : ""}` : "—"}
                    </td>
                    {isSuper && (
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {item.branchName}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                      ₹{formatMoney(item.totalPayable, grouping)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      ₹{formatMoney(item.totalPaid, grouping)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${item.outstandingAmount > 0 ? "text-amber-600 dark:text-amber-400" : item.outstandingAmount < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                      {item.outstandingAmount < 0 ? `-₹${formatMoney(Math.abs(item.outstandingAmount), grouping)}` : `₹${formatMoney(item.outstandingAmount, grouping)}`}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {item.overdueAmount > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center justify-end gap-1">
                          <AlertCircle className="size-3.5" />
                          ₹{formatMoney(item.overdueAmount, grouping)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          item.paymentStatus === "Paid"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                            : item.paymentStatus === "Advance / Credit"
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                            : item.paymentStatus === "Overdue"
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                            : item.paymentStatus === "Partially Paid"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            : "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30"
                        }`}
                      >
                        {item.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-medium">
                      {item.lastPaymentDate ? formatListDate(item.lastPaymentDate) : "No payments"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          className="font-semibold hover:bg-accent"
                          onClick={() => handleOpenDetails(item)}
                        >
                          <Eye className="size-3.5" />
                          Bills
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="font-semibold hover:bg-accent"
                          render={<Link href={`/ledger?vendorId=${item.id}`} />}
                        >
                          Ledger
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t p-4 bg-muted/20 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Showing {fromItem}–{toItem} of {data.totalVendors} vendors</span>
              <span className="mx-1">•</span>
              <span>Rows per page:</span>
              <Select value={String(data.pageSize)} onValueChange={setPageSize}>
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Page {data.page} of {data.totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1 || pending}
                onClick={() => setPage(data.page - 1)}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages || pending}
                onClick={() => setPage(data.page + 1)}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Drilldown Details Dialog */}
      <VendorDetailsDialog
        vendor={selectedVendor}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        grouping={grouping}
      />
    </>
  );
}
