import type { Metadata } from "next";
import { LedgerStatus, PaymentMethod, Role } from "@prisma/client";
import { Wallet } from "lucide-react";
import { requireAnyPermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import { listLedger } from "@/modules/ledger/ledger-service";
import { listSelectableCustomers } from "@/modules/customers/customer-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { getSettings } from "@/modules/settings/settings-service";
import { formatListDate, formatMoney } from "@/lib/format/number";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";
import { LedgerEntryDialog } from "@/components/ledger/LedgerEntryDialog";
import { LedgerRowActions } from "@/components/ledger/LedgerRowActions";

export const metadata: Metadata = { title: "Cash ledger" };
export const dynamic = "force-dynamic";

const VIEW_PERMISSIONS = [
  PERMISSIONS.LEDGER_VIEW_ALL,
  PERMISSIONS.LEDGER_VIEW_BRANCH,
  PERMISSIONS.LEDGER_VIEW_OWN,
] as const;

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function LedgerPage({ searchParams }: PageProps) {
  const user = await requireAnyPermission(VIEW_PERMISSIONS);
  const params = await searchParams;

  const isSuper = user.role === Role.SUPER_ADMIN;
  const canApprove = hasPermission(user, PERMISSIONS.LEDGER_APPROVE);

  const [page, customers, branches, settings] = await Promise.all([
    listLedger(user, {
      search: params.search,
      from: params.from,
      to: params.to,
      status: params.status as LedgerStatus | undefined,
      paymentMethod: params.paymentMethod as PaymentMethod | undefined,
      branchId: params.branchId,
    }),
    listSelectableCustomers(user, user.branchId ?? undefined),
    isSuper ? listSelectableBranches(user) : Promise.resolve([]),
    getSettings(user.branchId),
  ]);

  const grouping = settings.display.numberGrouping;
  const money = (value: number) => formatMoney(value, grouping);

  // Newest first for reading; the running balance was accumulated oldest-first.
  const rows = [...page.rows].reverse();

  const summary = [
    { label: "Opening balance", value: money(page.openingBalance) },
    { label: "Credits", value: money(page.totalCredit), tone: "text-emerald-600" },
    { label: "Debits", value: money(page.totalDebit), tone: "text-red-600" },
    { label: "Pending", value: money(page.pendingAmount), tone: "text-amber-600" },
    { label: "Closing balance", value: money(page.closingBalance), strong: true },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Cash ledger"
        description={`${page.count} ${page.count === 1 ? "entry" : "entries"}${user.branchName ? ` · ${user.branchName}` : ""}`}
        actions={
          hasPermission(user, PERMISSIONS.LEDGER_CREATE) ? (
            <LedgerEntryDialog
              customers={customers.map((c) => ({ id: c.id, name: c.name }))}
              branches={branches.map((b) => ({ id: b.id, name: b.name }))}
              canSelectBranch={isSuper}
              canApprove={canApprove}
              defaultBranchId={user.branchId}
            />
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-5">
        {summary.map((cell) => (
          <div key={cell.label} className="bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {cell.label}
            </p>
            <p
              className={`text-lg font-semibold tabular-nums ${cell.tone ?? ""} ${
                cell.strong ? "text-xl" : ""
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
                placeholder: "Reference, paid through, customer…",
              },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: Object.values(LedgerStatus).map((status) => ({
                  value: status,
                  label: status.toLowerCase(),
                })),
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

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Wallet className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No ledger entries</p>
              <p className="text-sm text-muted-foreground">
                Record a payment to start the cash book.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Reference</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Date</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Paid Through</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Method</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Credit</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Debit</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Balance</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {row.reference}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatListDate(row.entryDate)}
                    </td>
                    <td className="px-4 py-3">{row.customerName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.particular}
                      {row.quotationReference && (
                        <span className="block text-xs text-muted-foreground">
                          {row.quotationReference}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-muted-foreground">
                      {row.paymentMethod.replace(/_/g, " ").toLowerCase()}
                      {row.referenceNo && (
                        <span className="block font-mono">{row.referenceNo}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                      {row.direction === "CREDIT" ? money(row.amount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-700">
                      {row.direction === "DEBIT" ? money(row.amount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {money(row.runningBalance)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} kind="ledger" />
                    </td>
                    <td className="px-4 py-3">
                      <LedgerRowActions
                        id={row.id}
                        reference={row.reference}
                        status={row.status}
                        canApprove={canApprove}
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
