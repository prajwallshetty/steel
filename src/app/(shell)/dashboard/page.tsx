import Link from "next/link";
import type { Metadata } from "next";
import { LedgerStatus, Role } from "@prisma/client";
import {
  Building2,
  FileClock,
  FileText,
  IndianRupee,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  CalendarDays,
  Activity,
} from "lucide-react";
import { requireUser } from "@/modules/auth/guard";
import { getDashboardMetrics } from "@/modules/dashboard/dashboard-service";
import { getSettings } from "@/modules/settings/settings-service";
import { ROLE_LABELS } from "@/modules/permissions/permissions";
import { formatListDate, formatMoney } from "@/lib/format/number";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeading } from "@/components/layout/PageHeading";
import { ExportButton } from "@/components/reports/ExportButton";
import { FilterBar } from "@/components/shared/FilterBar";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const filters = {
    from: params.from,
    to: params.to,
  };

  const [metrics, settings] = await Promise.all([
    getDashboardMetrics(user, filters),
    getSettings(user.branchId),
  ]);

  const grouping = settings.display.numberGrouping;
  const money = (value: number) => formatMoney(value, grouping);
  const isSuper = user.role === Role.SUPER_ADMIN;
  const isManager = user.role === Role.MANAGER;

  const isFiltered = Boolean(filters.from || filters.to);

  // Row 1: Core Financial Balances
  const balanceCards = [
    {
      label: "Cash Balance",
      value: money(metrics.cashBalance),
      hint: "Total settled cash in hand",
      icon: Wallet,
      tone: metrics.cashBalance >= 0 ? "text-emerald-600 bg-emerald-500/10" : "text-red-600 bg-red-500/10",
    },
    {
      label: isFiltered ? "Total Incoming" : "Today's Incoming",
      value: money(metrics.receiptsToday),
      hint: isFiltered ? "Incoming funds in period" : "Incoming funds today",
      icon: ArrowUpRight,
      tone: "text-emerald-600 bg-emerald-500/10",
    },
    {
      label: isFiltered ? "Total Outgoing" : "Today's Outgoing",
      value: money(metrics.paymentsToday),
      hint: isFiltered ? "Outgoing payments in period" : "Outgoing payments today",
      icon: ArrowDownLeft,
      tone: "text-red-600 bg-red-500/10",
    },
  ];

  // Row 2: Today's / Period's Actions
  const todayCards = [
    {
      label: isFiltered ? "Sales in Period" : "Month's Sales",
      value: money(isFiltered ? metrics.totalRevenue : metrics.monthRevenue),
      hint: "Approved sales quotations",
      icon: IndianRupee,
      tone: "text-blue-600 bg-blue-500/10",
    },
    {
      label: isFiltered ? "Quotations in Period" : "Today's Quotations",
      value: String(metrics.todayQuotations),
      hint: `${metrics.totalQuotations} total quotations`,
      icon: FileText,
      tone: "text-neutral-700 bg-neutral-500/10",
    },
    {
      label: "Pending Approvals",
      value: String(metrics.pendingQuotations),
      hint: metrics.pendingQuotations > 0 ? "Requires review" : "All cleared",
      icon: FileClock,
      tone: metrics.pendingQuotations > 0 ? "text-red-600 bg-red-500/10" : "text-neutral-500 bg-neutral-500/5",
    },
    {
      label: "Total Customers",
      value: String(metrics.totalCustomers),
      hint: "Active customer accounts",
      icon: Users,
      tone: "text-indigo-600 bg-indigo-500/10",
    },
  ];

  const peakRevenue = Math.max(
    1,
    ...metrics.monthlyRevenue.map((point) => point.revenue),
  );

  const peakFlow = Math.max(
    1,
    ...metrics.monthlyCashFlow.map((point) => Math.max(point.incoming, point.outgoing))
  );

  const exportQuery = new URLSearchParams({ kind: "ledger" });
  if (filters.from) exportQuery.set("from", filters.from);
  if (filters.to) exportQuery.set("to", filters.to);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description={`${ROLE_LABELS[user.role]}${user.branchName ? ` · ${user.branchName}` : " · All branches"}`}
        actions={
          <div className="flex gap-2">
            <ExportButton href={`/api/reports/export?${exportQuery.toString()}&format=csv`} label="Export CSV" />
            <ExportButton href={`/api/reports/export?${exportQuery.toString()}&format=pdf`} label="Export PDF" />
          </div>
        }
      />

      {/* Date Filter Bar */}
      <Card>
        <CardContent className="py-4">
          <FilterBar
            fields={[
              { key: "from", label: "From", type: "date" },
              { key: "to", label: "To", type: "date" },
            ]}
          />
        </CardContent>
      </Card>

      {/* Super Admin Division Financial Overview */}
      {isSuper && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground select-none">
                Divisions Financial Overview
              </h2>
              <p className="text-xs text-muted-foreground">
                Configured starting balances automatically carry forward previous day closing balances.
              </p>
            </div>
            <Link
              href="/admin/branches"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              Manage Divisions &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {metrics.divisionFinancials.map((div) => (
              <Card key={div.id} className="border-t-4 border-t-primary shadow-xs">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-foreground">
                      {div.name}
                    </CardTitle>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                      {div.code}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Opening Balance</span>
                    <span className="font-bold tabular-nums text-foreground">{money(div.openingBalance)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Total Revenue</span>
                    <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{money(div.totalRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Total Expenses</span>
                    <span className="font-bold tabular-nums text-red-600 dark:text-red-400">-{money(div.totalExpenses)}</span>
                  </div>
                  <div className="pt-2 border-t flex items-center justify-between text-sm">
                    <span className="font-bold text-foreground">Closing Balance</span>
                    <span className="font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{money(div.closingBalance)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Cash in Hand</span>
                    <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">{money(div.cashInHand)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Overall Combined Summary Card */}
            <Card className="border-t-4 border-t-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs">
              <CardHeader className="pb-3 border-b bg-emerald-500/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-emerald-950 dark:text-emerald-100">
                    Overall Summary
                  </CardTitle>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-600 text-white uppercase">
                    Combined
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Total Revenue</span>
                  <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{money(metrics.overallFinancials.totalRevenue)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Total Expenses</span>
                  <span className="font-bold tabular-nums text-red-600 dark:text-red-400">-{money(metrics.overallFinancials.totalExpenses)}</span>
                </div>
                <div className="pt-2 border-t flex items-center justify-between text-sm">
                  <span className="font-bold text-foreground">Total Closing Balance</span>
                  <span className="font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{money(metrics.overallFinancials.totalClosingBalance)}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Total Cash in Hand</span>
                  <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">{money(metrics.overallFinancials.totalCashInHand)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Group 1: Account Balances */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 select-none">
          Financial Position
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {balanceCards.map((card) => (
            <Card key={card.label} className="group/metric transition-all duration-300 hover:border-primary/20">
              <CardContent className="flex items-center justify-between gap-4 py-6">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="truncate text-2xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
                    {card.value}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium truncate">
                    {card.hint}
                  </p>
                </div>
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${card.tone}`}>
                  <card.icon className="size-6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Group 2: Today's Performance */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 select-none">
          {isFiltered ? "Period's Performance" : "Today's Performance"}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {todayCards.map((card) => (
            <Card key={card.label} className="group/metric transition-all duration-300 hover:border-primary/20">
              <CardContent className="flex items-center justify-between gap-4 py-5">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="truncate text-xl font-extrabold tracking-tight text-neutral-950 tabular-nums">
                    {card.value}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium truncate">
                    {card.hint}
                  </p>
                </div>
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${card.tone}`}>
                  <card.icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cash Flow Comparison Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{isFiltered ? "Cash Flow in period" : "Cash Flow, last 12 months"}</CardTitle>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span className="font-semibold text-muted-foreground">Incoming</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-red-500" />
                <span className="font-semibold text-muted-foreground">Outgoing</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {metrics.monthlyCashFlow.every((point) => point.incoming === 0 && point.outgoing === 0) ? (
              <EmptyNote>{isFiltered ? "No cash flow records in this period." : "No cash flow records in this period yet."}</EmptyNote>
            ) : (
              <div className="relative h-56 pt-4">
                {/* Background grid lines */}
                <div className="absolute inset-x-0 bottom-6 top-4 flex flex-col justify-between pointer-events-none z-0">
                  <div className="w-full border-t border-muted/50 border-dashed" />
                  <div className="w-full border-t border-muted/50 border-dashed" />
                  <div className="w-full border-t border-muted/50 border-dashed" />
                  <div className="w-full border-t border-muted/50 border-dashed" />
                  <div className="w-full" />
                </div>

                {/* Double Bars */}
                <div className="relative flex h-full items-end gap-3 z-10 px-2">
                  {metrics.monthlyCashFlow.map((point) => (
                    <div
                      key={point.month}
                      className="group relative flex flex-1 flex-col items-center gap-2"
                    >
                      {/* Premium CSS Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border text-[10px] py-1.5 px-2.5 rounded-md shadow-md transition-all duration-200 scale-95 group-hover:scale-100 whitespace-nowrap z-30 font-bold flex flex-col items-center select-none">
                        <span className="text-[9px] font-medium text-muted-foreground capitalize">
                          {new Date(point.month + "-02").toLocaleString("default", { month: "short", year: "numeric" })}
                        </span>
                        <span className="text-emerald-600 mt-0.5">In: {money(point.incoming)}</span>
                        <span className="text-red-600">Out: {money(point.outgoing)}</span>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-popover" />
                      </div>

                      {/* Bar columns */}
                      <div className="flex w-full items-end gap-1 justify-center">
                        <div
                          className="w-2.5 rounded-t bg-emerald-500 transition-all duration-300 hover:opacity-90 origin-bottom"
                          style={{
                            height: `${Math.max(2, (point.incoming / peakFlow) * 130)}px`,
                          }}
                        />
                        <div
                          className="w-2.5 rounded-t bg-red-500 transition-all duration-300 hover:opacity-90 origin-bottom"
                          style={{
                            height: `${Math.max(2, (point.outgoing / peakFlow) * 130)}px`,
                          }}
                        />
                      </div>

                      <span className="text-[10px] font-semibold text-muted-foreground tracking-tight select-none mt-1">
                        {new Date(point.month + "-02").toLocaleString("default", { month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Panel */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center gap-3">
            <Link
              href="/quotations/new"
              className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all group/action shadow-xs"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 group-hover/action:scale-105 transition-transform duration-200">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">New Quotation</p>
                <p className="text-[10px] text-muted-foreground font-medium truncate">Create a sales quote</p>
              </div>
            </Link>

            <Link
              href="/customer-payments"
              className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all group/action shadow-xs"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 group-hover/action:scale-105 transition-transform duration-200">
                <ArrowDownLeft className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">Customer Payments</p>
                <p className="text-[10px] text-muted-foreground font-medium truncate">Customer receipts & payments</p>
              </div>
            </Link>

            <Link
              href="/vendor-payments"
              className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all group/action shadow-xs"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 group-hover/action:scale-105 transition-transform duration-200">
                <ArrowUpRight className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">Vendor Payments</p>
                <p className="text-[10px] text-muted-foreground font-medium truncate">Vendor receipts & payments</p>
              </div>
            </Link>

            <Link
              href="/customers"
              className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all group/action shadow-xs"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 group-hover/action:scale-105 transition-transform duration-200">
                <Users className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">Add Customer</p>
                <p className="text-[10px] text-muted-foreground font-medium truncate">View and add customer profiles</p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's Transactions */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle>{isFiltered ? "Transactions in Period" : "Today's Transactions"}</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {metrics.todayTransactions.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyNote>{isFiltered ? "No transactions recorded in this period." : "No transactions recorded today."}</EmptyNote>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-y bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                      <th scope="col" className="px-6 py-3.5 text-left font-bold">Voucher No</th>
                      <th scope="col" className="px-6 py-3.5 text-left font-bold">Party Name</th>
                      <th scope="col" className="px-6 py-3.5 text-left font-bold">Particulars</th>
                      <th scope="col" className="px-6 py-3.5 text-right font-bold">Amount</th>
                      <th scope="col" className="px-6 py-3.5 text-left font-bold">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.todayTransactions.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors duration-150">
                        <td className="px-6 py-4 font-mono font-semibold text-primary">{row.reference}</td>
                        <td className="px-6 py-4 font-medium">{row.partyName}</td>
                        <td className="px-6 py-4 text-xs text-muted-foreground max-w-[180px] truncate">{row.particular}</td>
                        <td className={`px-6 py-4 text-right font-bold tabular-nums ${row.direction === "CREDIT" ? "text-emerald-600" : "text-red-600"}`}>
                          {row.direction === "CREDIT" ? "+" : "-"}{money(row.amount)}
                        </td>
                        <td className="px-6 py-4">
                          {row.direction === "CREDIT" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase border border-emerald-200">
                              Cash In
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase border border-red-200">
                              Cash Out
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manager/Branch Perf */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>
              {isSuper ? "Branch performance" : (isFiltered ? "Revenue in period" : "Revenue, last 12 months")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {isSuper ? (
              metrics.branchPerformance.length === 0 ? (
                <EmptyNote>No branch revenue recorded yet.</EmptyNote>
              ) : (
                metrics.branchPerformance.map((row) => (
                  <BarRow
                    key={row.branchName}
                    label={row.branchName}
                    detail={`${row.quotations} quotation${row.quotations === 1 ? "" : "s"}`}
                    value={money(row.revenue)}
                    fraction={
                      row.revenue /
                      Math.max(
                        1,
                        ...metrics.branchPerformance.map((b) => b.revenue),
                      )
                    }
                  />
                ))
              )
            ) : metrics.monthlyRevenue.every((point) => point.revenue === 0) ? (
              <EmptyNote>{isFiltered ? "No approved quotations in this period." : "No approved quotations in this period yet."}</EmptyNote>
            ) : (
              (isFiltered ? metrics.monthlyRevenue : metrics.monthlyRevenue.slice(-6)).map((point) => (
                <BarRow
                  key={point.month}
                  label={new Date(point.month + "-02").toLocaleString("default", { month: "short", year: "numeric" })}
                  value={money(point.revenue)}
                  fraction={
                    point.revenue /
                    Math.max(1, ...metrics.monthlyRevenue.map((p) => p.revenue))
                  }
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BarRow({
  label,
  detail,
  value,
  fraction,
}: {
  readonly label: string;
  readonly detail?: string;
  readonly value: string;
  readonly fraction: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-semibold capitalize text-foreground">{label}</span>
        <span className="shrink-0 font-bold text-foreground tabular-nums">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
          style={{ width: `${Math.max(2, fraction * 100)}%` }}
        />
      </div>
      {detail && <p className="text-xs text-muted-foreground font-medium">{detail}</p>}
    </div>
  );
}

const EmptyNote = ({ children }: { readonly children: React.ReactNode }) => (
  <p className="py-8 text-center text-sm text-muted-foreground font-medium select-none">{children}</p>
);
