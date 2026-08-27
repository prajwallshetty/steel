import type { Metadata } from "next";
import Link from "next/link";
import { Role } from "@prisma/client";
import { BookOpen, Users, Printer, Building } from "lucide-react";
import { requireAnyPermission } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import { listSelectableCustomers } from "@/modules/customers/customer-service";
import { listSelectableVendors } from "@/modules/vendors/vendor-service";
import { getCustomerLedger, getVendorLedger, getConsolidatedLedger } from "@/modules/receipt-payment/receipt-service";
import { getSettings } from "@/modules/settings/settings-service";
import { formatListDate, formatMoney } from "@/lib/format/number";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/layout/PageHeading";
import { LedgerFilter } from "./LedgerFilter";
import { Button } from "@/components/ui/button";

import { getActiveBranchFilter } from "@/modules/branches/branch-context";

export const metadata: Metadata = { title: "Ledger Accounts" };
export const dynamic = "force-dynamic";

const VIEW_PERMISSIONS = [
  PERMISSIONS.LEDGER_VIEW_ALL,
  PERMISSIONS.LEDGER_VIEW_BRANCH,
  PERMISSIONS.LEDGER_VIEW_OWN,
] as const;

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CustomerLedgerPage({ searchParams }: PageProps) {
  const user = await requireAnyPermission(VIEW_PERMISSIONS);
  const params = await searchParams;

  const activeBranchId = await getActiveBranchFilter(user, params.branchId);

  const [customers, vendors, settings] = await Promise.all([
    listSelectableCustomers(user, activeBranchId),
    listSelectableVendors(user, activeBranchId),
    getSettings(user.branchId),
  ]);

  const grouping = settings.display.numberGrouping;
  const money = (value: number) => formatMoney(value, grouping);

  const partyType = params.partyType ?? "customer";
  const selectedCustomerId = params.customerId;
  const selectedVendorId = params.vendorId;

  let ledger = null;
  let isFilteredAccount = false;

  if (partyType === "vendor" && selectedVendorId) {
    isFilteredAccount = true;
    try {
      ledger = await getVendorLedger(user, selectedVendorId, {
        from: params.from,
        to: params.to,
        branchId: activeBranchId,
      });
    } catch (e) {
      console.error(e);
    }
  } else if (partyType === "customer" && selectedCustomerId) {
    isFilteredAccount = true;
    try {
      ledger = await getCustomerLedger(user, selectedCustomerId, {
        from: params.from,
        to: params.to,
        branchId: activeBranchId,
      });
    } catch (e) {
      console.error(e);
    }
  } else {
    // Show full consolidated ledger across all transactions
    try {
      ledger = await getConsolidatedLedger(user, {
        from: params.from,
        to: params.to,
        branchId: activeBranchId,
      });
    } catch (e) {
      console.error(e);
    }
  }

  const accountName = isFilteredAccount
    ? (ledger?.customerName ?? ledger?.vendorName ?? "Account")
    : "Consolidated General Ledger (All Transactions)";

  const printHref = partyType === "vendor" && selectedVendorId
    ? `/ledger/print?vendorId=${selectedVendorId}&partyType=vendor${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`
    : `/ledger/print?customerId=${selectedCustomerId}&partyType=customer${params.from ? `&from=${params.from}` : ""}${params.to ? `&to=${params.to}` : ""}`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title={accountName}
        description="Showing full financial transactions (invoices, bills, receipts, and payments). Filter by customer or vendor below."
        actions={
          isFilteredAccount && (selectedCustomerId || selectedVendorId) ? (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={printHref} target="_blank" />}
            >
              <Printer className="size-4 mr-1.5" />
              Print Statement
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="py-4">
          <LedgerFilter customers={customers} vendors={vendors} />
        </CardContent>
      </Card>

      {!ledger ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Users className="size-12 text-muted-foreground/60" />
            <div>
              <p className="font-semibold text-lg text-foreground">Account not found</p>
              <p className="text-sm">
                The selected account was not found or is outside of your scope.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card className="bg-card">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  Opening Balance
                </p>
                <p className="text-xl font-bold tabular-nums text-foreground mt-1">
                  {money(ledger.openingBalance)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  Total Debits / Payments
                </p>
                <p className="text-xl font-bold tabular-nums text-red-600 mt-1">
                  {money(ledger.totalDebit)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  Total Credits / Receipts
                </p>
                <p className="text-xl font-bold tabular-nums text-emerald-600 mt-1">
                  {money(ledger.totalCredit)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-primary font-semibold">
                  Closing Balance
                </p>
                <p className="text-2xl font-black tabular-nums text-foreground mt-1">
                  {money(ledger.closingBalance)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden py-0 border border-border/80 shadow-xs">
            {ledger.rows.length === 0 ? (
              <CardContent className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <BookOpen className="size-8 text-muted-foreground/60" />
                <p>No transactions found for the selected filter/period.</p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                      <th scope="col" className="px-4 py-3 text-left font-bold">Date</th>
                      <th scope="col" className="px-4 py-3 text-left font-bold">Voucher No</th>
                      <th scope="col" className="px-4 py-3 text-left font-bold">Type</th>
                      {!isFilteredAccount && (
                        <th scope="col" className="px-4 py-3 text-left font-bold">Party Name</th>
                      )}
                      <th scope="col" className="px-4 py-3 text-left font-bold">Description</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold">Debit (+)</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold">Credit (-)</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Render Opening Balance Row */}
                    <tr className="border-b bg-muted/20 font-medium italic">
                      <td className="px-4 py-3 text-muted-foreground">
                        {params.from ? formatListDate(params.from) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">—</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          O/B
                        </span>
                      </td>
                      {!isFilteredAccount && (
                        <td className="px-4 py-3 text-muted-foreground">—</td>
                      )}
                      <td className="px-4 py-3 text-muted-foreground">Opening Balance B/F</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ledger.openingBalance > 0 ? money(ledger.openingBalance) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ledger.openingBalance < 0 ? money(Math.abs(ledger.openingBalance)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                        {money(ledger.openingBalance)}
                      </td>
                    </tr>

                    {ledger.rows.map((row: any) => (
                      <tr
                        key={row.id}
                        className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatListDate(row.date)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                          {row.voucherNo}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              row.type === "INVOICE" || row.type === "BILL"
                                ? "bg-blue-100 text-blue-700 border-blue-200"
                                : row.type === "RECEIPT"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-orange-100 text-orange-700 border-orange-200"
                            }`}
                          >
                            {row.type}
                          </span>
                        </td>
                        {!isFilteredAccount && (
                          <td className="px-4 py-3 text-foreground font-semibold">
                            {row.partyName || "—"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-foreground font-medium">
                          {row.description}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600 tabular-nums">
                          {row.debit > 0 ? money(row.debit) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700 tabular-nums">
                          {row.credit > 0 ? money(row.credit) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">
                          {money(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

