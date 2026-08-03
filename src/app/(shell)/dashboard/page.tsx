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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue, last 12 months</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.monthlyRevenue.every((point) => point.revenue === 0) ? (
              <EmptyNote>No approved quotations in this period yet.</EmptyNote>
            ) : (
              <div className="flex h-48 items-end gap-2.5 pt-4">
                {metrics.monthlyRevenue.map((point) => (
                  <div
                    key={point.month}
                    className="group flex flex-1 flex-col items-center gap-2"
                    title={`${point.month}: ${money(point.revenue)}`}
                  >
                    <div
                      className="w-full rounded-t bg-primary/85 transition-all duration-300 hover:bg-primary hover:shadow-xs group-hover:scale-y-102 origin-bottom"
                      style={{
                        // Minimum 2px so a zero month is still a visible tick.
                        height: `${Math.max(2, (point.revenue / peakRevenue) * 160)}px`,
                      }}
                    />
                    <span className="text-[10px] font-semibold text-muted-foreground tracking-tight select-none">
                      {point.month.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>

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
