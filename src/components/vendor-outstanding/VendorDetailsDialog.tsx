"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle2,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { formatMoney, formatListDate } from "@/lib/format/number";
import type { NumberGrouping } from "@/types/settings";
import type { VendorOutstandingSummary } from "@/modules/vendor-outstanding/vendor-outstanding-service";
import Link from "next/link";

interface VendorDetailsDialogProps {
  readonly vendor: VendorOutstandingSummary | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly grouping?: NumberGrouping;
}

export function VendorDetailsDialog({
  vendor,
  open,
  onOpenChange,
  grouping = "indian",
}: VendorDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<"bills" | "payments">("bills");

  if (!vendor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                {vendor.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {[vendor.city, vendor.state].filter(Boolean).join(", ") || "No location"}
                {vendor.phone && ` • Phone: ${vendor.phone}`}
                {vendor.gstNumber && ` • GST: ${vendor.gstNumber}`}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${
                  vendor.paymentStatus === "Paid"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : vendor.paymentStatus === "Advance / Credit"
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                    : vendor.paymentStatus === "Overdue"
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                    : vendor.paymentStatus === "Partially Paid"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    : "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30"
                }`}
              >
                {vendor.paymentStatus}
              </span>
              <Button variant="outline" size="sm" render={<Link href={`/ledger?vendorId=${vendor.id}`} />}>
                View Full Ledger
                <ArrowUpRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Overview KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Payable</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">₹{formatMoney(vendor.totalPayable, grouping)}</p>
          </div>
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Paid</p>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
              ₹{formatMoney(vendor.totalPaid, grouping)}
            </p>
          </div>
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding Dues</p>
            <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
              ₹{formatMoney(vendor.outstandingAmount, grouping)}
            </p>
          </div>
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Overdue Dues</p>
            <p className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
              ₹{formatMoney(vendor.overdueAmount, grouping)}
            </p>
          </div>
        </div>

        {/* Ageing Breakdown */}
        <div className="p-4 rounded-lg border bg-muted/40 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3.5" /> Ageing Dues Breakdown
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-background p-2.5 rounded border text-center">
              <p className="text-[10px] font-medium text-muted-foreground">0 - 30 Days (Current)</p>
              <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">
                ₹{formatMoney(vendor.ageing.current, grouping)}
              </p>
            </div>
            <div className="bg-background p-2.5 rounded border text-center">
              <p className="text-[10px] font-medium text-muted-foreground">31 - 60 Days</p>
              <p className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                ₹{formatMoney(vendor.ageing.days31To60, grouping)}
              </p>
            </div>
            <div className="bg-background p-2.5 rounded border text-center">
              <p className="text-[10px] font-medium text-muted-foreground">61 - 90 Days</p>
              <p className="text-sm font-bold tabular-nums text-orange-600 dark:text-orange-400 mt-0.5">
                ₹{formatMoney(vendor.ageing.days61To90, grouping)}
              </p>
            </div>
            <div className="bg-background p-2.5 rounded border text-center">
              <p className="text-[10px] font-medium text-muted-foreground">91+ Days</p>
              <p className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
                ₹{formatMoney(vendor.ageing.days91Plus, grouping)}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs for Bills vs Payment History */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full mt-2">
          <TabsList variant="line" className="border-b w-full justify-start rounded-none p-0">
            <TabsTrigger value="bills" className="py-2">
              <FileText className="size-4" />
              Purchase Bills ({vendor.bills.length})
            </TabsTrigger>
            <TabsTrigger value="payments" className="py-2">
              <Receipt className="size-4" />
              Payment History ({vendor.paymentHistory.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="pt-3">
            {vendor.bills.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No purchase bills recorded for this vendor.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground uppercase font-semibold">
                      <th className="px-3 py-2 text-left">Bill #</th>
                      <th className="px-3 py-2 text-left">Bill Date</th>
                      <th className="px-3 py-2 text-left">Due Date</th>
                      <th className="px-3 py-2 text-right">Bill Amount</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendor.bills.map((bill) => (
                      <tr key={bill.id} className="border-b transition-colors hover:bg-muted/30">
                        <td className="px-3 py-2.5 font-bold">{bill.billNumber}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatListDate(bill.billDate)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {formatListDate(bill.dueDate)}
                          {bill.isOverdue && (
                            <span className="block text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                              {bill.daysOverdue} days overdue
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          ₹{formatMoney(bill.amount, grouping)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          ₹{formatMoney(bill.paidAmount, grouping)}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${bill.outstandingAmount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                          ₹{formatMoney(bill.outstandingAmount, grouping)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              bill.status === "Paid"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : bill.status === "Overdue"
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                : bill.status === "Partially Paid"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                : "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30"
                            }`}
                          >
                            {bill.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="pt-3">
            {vendor.paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No payment history entries recorded.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground uppercase font-semibold">
                      <th className="px-3 py-2 text-left">Ref #</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Method</th>
                      <th className="px-3 py-2 text-left">Particulars</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendor.paymentHistory.map((item) => (
                      <tr key={item.id} className="border-b transition-colors hover:bg-muted/30">
                        <td className="px-3 py-2.5 font-bold">{item.reference}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatListDate(item.entryDate)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {item.paymentMethod}
                          {item.referenceNo && ` (${item.referenceNo})`}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate">
                          {item.particular}
                          {item.vendorBillNumber && ` [Bill: ${item.vendorBillNumber}]`}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          ₹{formatMoney(item.amount, grouping)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
