import type { Metadata } from "next";
import { LedgerStatus, PaymentMethod, Role, LedgerDirection } from "@prisma/client";
import { Wallet } from "lucide-react";
import { requireAnyPermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import { listPartnerPayments } from "@/modules/receipt-payment/partner-payment-service";
import { listSelectableCustomers } from "@/modules/customers/customer-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { getSettings } from "@/modules/settings/settings-service";
import { formatListDate, formatMoney } from "@/lib/format/number";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";
import { CustomerPaymentDialog } from "@/components/receipt-payment/CustomerPaymentDialog";
import { PartnerPaymentRowActions } from "@/components/receipt-payment/PartnerPaymentRowActions";

import { getActiveBranchFilter } from "@/modules/branches/branch-context";

export const metadata: Metadata = { title: "Customer Payments" };
export const dynamic = "force-dynamic";

const VIEW_PERMISSIONS = [
  PERMISSIONS.LEDGER_VIEW_ALL,
  PERMISSIONS.LEDGER_VIEW_BRANCH,
  PERMISSIONS.LEDGER_VIEW_OWN,
] as const;

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CustomerPaymentsPage({ searchParams }: PageProps) {
  const user = await requireAnyPermission(VIEW_PERMISSIONS);
  const params = await searchParams;

  const activeBranchId = await getActiveBranchFilter(user, params.branchId);
  const isSuper = user.role === Role.SUPER_ADMIN;
  const canApprove = hasPermission(user, PERMISSIONS.LEDGER_APPROVE);

  const [
    page,
    customers,
    branches,
    settings,
  ] = await Promise.all([
    listPartnerPayments(user, "CUSTOMER", {
      search: params.search,
      from: params.from,
      to: params.to,
      status: params.status as LedgerStatus | undefined,
      paymentMethod: params.paymentMethod as PaymentMethod | undefined,
      direction: params.direction as LedgerDirection | undefined,
      branchId: activeBranchId,
    }),
    listSelectableCustomers(user, activeBranchId),
    isSuper ? listSelectableBranches(user) : Promise.resolve([]),
    getSettings(user.branchId),
  ]);

  const grouping = settings.display.numberGrouping;
  const money = (value: number) => formatMoney(value, grouping);

  const summary = [
    { label: "Opening Balance", value: money(page.openingBalance) },
    { label: "Total Receipts (+)", value: money(page.totalCredit), tone: "text-emerald-600" },
    { label: "Total Payments (-)", value: money(page.totalDebit), tone: "text-red-600" },
    { label: "Pending Entries", value: money(page.pendingAmount), tone: "text-amber-600" },
    { label: "Current Balance", value: money(page.closingBalance), strong: true },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Customer Payments"
        description={`${page.count} transaction ${page.count === 1 ? "voucher" : "vouchers"}${user.branchName ? ` · ${user.branchName}` : ""}`}
        actions={
          hasPermission(user, PERMISSIONS.LEDGER_CREATE) ? (
            <CustomerPaymentDialog
              customers={customers.map((c) => ({ id: c.id, name: c.name, city: c.city }))}
              branches={branches.map((b) => ({ id: b.id, name: b.name }))}
              canSelectBranch={isSuper}
              defaultBranchId={user.branchId}
            />
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-5">
        {summary.map((cell) => (
          <div key={cell.label} className="bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              {cell.label}
            </p>
            <p
              className={`text-lg font-semibold tabular-nums ${cell.tone ?? ""} ${
                cell.strong ? "text-xl font-bold" : ""
              }`}
            >
              {cell.value}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="py-4">
          <FilterBar
            fields={[
              {
                key: "search",
                label: "Search",
                type: "search",
                placeholder: "Voucher No, customer, reference…",
              },
              {
                key: "direction",
                label: "Payment Type",
                type: "select",
                options: [
                  { value: "CREDIT", label: "Receipt (Money In)" },
                  { value: "DEBIT", label: "Payment (Money Out)" },
                ],
              },
              {
                key: "paymentMethod",
                label: "Method",
                type: "select",
                options: Object.values(PaymentMethod).map((method) => ({
                  value: method,
                  label: method.replace(/_/g, " ").toLowerCase(),
                })),
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
              { key: "from", label: "From", type: "date" },
              { key: "to", label: "To", type: "date" },
            ]}
          />
        </CardContent>
      </Card>

      {page.rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Wallet className="size-8 text-muted-foreground" />
            <div>
              <p className="font-semibold text-lg text-foreground">No transaction entries found</p>
              <p className="text-sm text-muted-foreground">
                Click &quot;Record Customer Payment&quot; to add a receipt or payment transaction.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  <th scope="col" className="px-4 py-3 text-left font-bold">Voucher No</th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">Date</th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">Type</th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">Customer Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">Description</th>
                  <th scope="col" className="px-4 py-3 text-left font-bold">Method</th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">Amount</th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                      {row.reference}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatListDate(row.entryDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          row.direction === LedgerDirection.CREDIT
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-red-100 text-red-700 border-red-200"
                        }`}
                      >
                        {row.direction === LedgerDirection.CREDIT ? "Receipt" : "Payment"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {row.partyName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.particular}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-muted-foreground">
                      {row.paymentMethod.replace(/_/g, " ").toLowerCase()}
                      {row.referenceNo && (
                        <span className="block font-mono text-[10px] font-semibold text-foreground">{row.referenceNo}</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold tabular-nums ${
                        row.direction === LedgerDirection.CREDIT ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {money(row.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <PartnerPaymentRowActions
                        id={row.id}
                        reference={row.reference}
                        direction={row.direction}
                        canDelete={hasPermission(user, PERMISSIONS.LEDGER_DELETE)}
                      />
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
