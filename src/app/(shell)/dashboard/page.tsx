import Link from "next/link";
import type { Metadata } from "next";
import { Role } from "@prisma/client";
import {
  Building2,
  FileClock,
  FileText,
  IndianRupee,
  Users,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/modules/auth/guard";
import { getDashboardMetrics } from "@/modules/dashboard/dashboard-service";
import { getSettings } from "@/modules/settings/settings-service";
import { ROLE_LABELS } from "@/modules/permissions/permissions";
import { formatListDate, formatMoney } from "@/lib/format/number";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeading } from "@/components/layout/PageHeading";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Role-aware dashboard.
 *
 * One page, three audiences. The metric service scopes every figure to the
 * caller, so the difference between a Super Admin's view and a manager's is
 * which cards are shown — not a separate query path that could disagree.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const [metrics, settings] = await Promise.all([
    getDashboardMetrics(user),
    getSettings(user.branchId),
  ]);

  const grouping = settings.display.numberGrouping;
  const money = (value: number) => formatMoney(value, grouping);
  const isSuper = user.role === Role.SUPER_ADMIN;
  const isManager = user.role === Role.MANAGER;

  const cards = [
    {
      label: isManager ? "My revenue" : "Total revenue",
      value: money(metrics.totalRevenue),
      hint: `${money(metrics.monthRevenue)} this month`,
      icon: IndianRupee,
    },
    {
      label: "Today's quotations",
      value: String(metrics.todayQuotations),
      hint: `${metrics.totalQuotations} in total`,
      icon: FileText,
    },
    {
      label: "Pending approval",
      value: String(metrics.pendingQuotations),
      hint: metrics.pendingQuotations > 0 ? "Needs review" : "All clear",
      icon: FileClock,
    },
    {
      label: "Collections",
      value: money(metrics.collections),
      hint: `${money(metrics.pendingPayments)} pending`,
      icon: Wallet,
    },
    {
      label: "Customers",
      value: String(metrics.totalCustomers),
      hint: user.branchName ?? "All branches",
      icon: Users,
    },
    ...(isSuper
      ? [
          {
            label: "Active branches",
            value: String(metrics.activeBranches ?? 0),
            hint: `${metrics.activeUsers ?? 0} active users`,
            icon: Building2,
          },
        ]
      : []),
  ];

  const peakRevenue = Math.max(
    1,
    ...metrics.monthlyRevenue.map((point) => point.revenue),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description={`${ROLE_LABELS[user.role]}${user.branchName ? ` · ${user.branchName}` : " · All branches"}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label} className="group/metric transition-all duration-300 hover:border-primary/20">
            <CardContent className="flex items-center justify-between gap-4 py-6">
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </p>
                <p className="truncate text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  {card.hint}
                </p>
              </div>
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary transition-all duration-300 group-hover/metric:bg-primary group-hover/metric:text-primary-foreground group-hover/metric:scale-105 group-hover/metric:shadow-sm">
                <card.icon className="size-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue, last 12 months</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.monthlyRevenue.every((point) => point.revenue === 0) ? (
              <EmptyNote>No approved quotations in this period yet.</EmptyNote>
            ) : (
              <div className="relative h-48 pt-4">
                {/* Background grid lines */}
                <div className="absolute inset-x-0 bottom-6 top-4 flex flex-col justify-between pointer-events-none z-0">
                  <div className="w-full border-t border-muted/50 border-dashed" />
                  <div className="w-full border-t border-muted/50 border-dashed" />
                  <div className="w-full border-t border-muted/50 border-dashed" />
                  <div className="w-full border-t border-muted/50 border-dashed" />
                  <div className="w-full" /> {/* Ground line */}
                </div>

                {/* Bars */}
                <div className="relative flex h-full items-end gap-2.5 z-10">
                  {metrics.monthlyRevenue.map((point) => (
                    <div
                      key={point.month}
                      className="group relative flex flex-1 flex-col items-center gap-2"
                    >
                      {/* Premium CSS Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border text-[10px] py-1.5 px-2.5 rounded-md shadow-md transition-all duration-200 scale-95 group-hover:scale-100 whitespace-nowrap z-30 font-bold flex flex-col items-center select-none">
                        <span className="text-[9px] font-medium text-muted-foreground capitalize">
                          {new Date(point.month + "-02").toLocaleString("default", { month: "short", year: "numeric" })}
                        </span>
                        <span className="text-foreground tracking-wide mt-0.5">{money(point.revenue)}</span>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-popover" />
                      </div>

                      {/* Bar with gradient and shadow */}
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-primary/80 to-primary transition-all duration-300 hover:opacity-95 hover:shadow-md hover:shadow-primary/10 origin-bottom"
                        style={{
                          // Minimum 2px so a zero month is still a visible tick.
                          height: `${Math.max(2, (point.revenue / peakRevenue) * 120)}px`,
                        }}
                      />
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
                <p className="text-[10px] text-muted-foreground font-medium truncate">Create a new sales quote</p>
              </div>
            </Link>

            <Link
              href="/ledger"
              className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all group/action shadow-xs"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 group-hover/action:scale-105 transition-transform duration-200">
                <Wallet className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">Record Payment</p>
                <p className="text-[10px] text-muted-foreground font-medium truncate">Add ledger credit or debit</p>
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
                <p className="text-xs font-bold text-foreground">Manage Customers</p>
                <p className="text-[10px] text-muted-foreground font-medium truncate">View and add customer profiles</p>
              </div>
            </Link>

            <Link
              href="/reports"
              className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all group/action shadow-xs"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 group-hover/action:scale-105 transition-transform duration-200">
                <Building2 className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">Analytics Reports</p>
                <p className="text-[10px] text-muted-foreground font-medium truncate">Export performance metrics</p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${(!isManager && metrics.managerPerformance.length > 0) ? "lg:grid-cols-2" : "w-full"}`}>
        <Card>
          <CardHeader>
            <CardTitle>
              {isSuper ? "Branch performance" : "Payment methods"}
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
            ) : metrics.paymentMix.length === 0 ? (
              <EmptyNote>No settled payments recorded yet.</EmptyNote>
            ) : (
              metrics.paymentMix.map((row) => (
                <BarRow
                  key={row.method}
                  label={row.method.replace(/_/g, " ")}
                  value={money(row.amount)}
                  fraction={
                    row.amount /
                    Math.max(1, ...metrics.paymentMix.map((p) => p.amount))
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        {!isManager && metrics.managerPerformance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Manager performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {metrics.managerPerformance.map((row) => (
                <BarRow
                  key={row.name}
                  label={row.name}
                  detail={`${row.quotations} quotation${row.quotations === 1 ? "" : "s"}`}
                  value={money(row.revenue)}
                  fraction={
                    row.revenue /
                    Math.max(
                      1,
                      ...metrics.managerPerformance.map((m) => m.revenue),
                    )
                  }
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="overflow-hidden py-0 shadow-sm border border-border/80">
        <CardHeader className="px-6 pt-6">
          <CardTitle>Recent quotations</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {metrics.recentQuotations.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyNote>Nothing here yet.</EmptyNote>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                    <th scope="col" className="px-6 py-3.5 text-left font-bold">Reference</th>
                    <th scope="col" className="px-6 py-3.5 text-left font-bold">Party</th>
                    <th scope="col" className="px-6 py-3.5 text-left font-bold">Date</th>
                    <th scope="col" className="px-6 py-3.5 text-right font-bold">Total</th>
                    <th scope="col" className="px-6 py-3.5 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentQuotations.map((row) => (
                    <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors duration-150">
                      <td className="px-6 py-4 font-semibold">
                        <Link
                          href={`/quotations/${row.id}`}
                          className="text-primary hover:text-primary/80 transition-colors font-bold"
                        >
                          {row.reference}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-foreground font-medium">{row.partyName}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatListDate(row.quotationDate)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground tabular-nums">
                        {money(row.grandTotal)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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
