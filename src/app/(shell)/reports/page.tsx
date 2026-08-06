import type { Metadata } from "next";
import { Role } from "@prisma/client";
import { requireAnyPermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import {
  buildReport,
  type ReportKind,
} from "@/modules/reports/report-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { getSettings } from "@/modules/settings/settings-service";
import { formatMoney } from "@/lib/format/number";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";
import { ReportTabs } from "@/components/reports/ReportTabs";
import { ExportButton } from "@/components/reports/ExportButton";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const VIEW_PERMISSIONS = [
  PERMISSIONS.REPORT_VIEW_ALL,
  PERMISSIONS.REPORT_VIEW_BRANCH,
  PERMISSIONS.REPORT_VIEW_OWN,
] as const;

const REPORTS: readonly { key: ReportKind; label: string; superOnly?: boolean }[] = [
  { key: "quotations", label: "Quotations" },
  { key: "customers", label: "Customers" },
  { key: "ledger", label: "Receipts & Payments" },
  { key: "gst", label: "GST" },
  { key: "manager-performance", label: "Managers" },
  { key: "branch-performance", label: "Branches", superOnly: true },
];

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const user = await requireAnyPermission(VIEW_PERMISSIONS);
  const params = await searchParams;

  const isSuper = user.role === Role.SUPER_ADMIN;
  const available = REPORTS.filter((report) => !report.superOnly || isSuper);

  const requested = params.kind as ReportKind | undefined;
  const kind: ReportKind =
    requested && available.some((report) => report.key === requested)
      ? requested
      : "quotations";

  const filters = {
    from: params.from,
    to: params.to,
    branchId: params.branchId,
    status: params.status,
  };

  const [report, branches, settings] = await Promise.all([
    buildReport(user, kind, filters),
    isSuper ? listSelectableBranches(user) : Promise.resolve([]),
    getSettings(user.branchId),
  ]);

  const grouping = settings.display.numberGrouping;

  const query = new URLSearchParams({ kind });
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }

  const totals = report.columns
    .filter((column) => column.numeric)
    .map((column) => ({
      key: column.key,
      total: report.rows.reduce(
        (sum, row) => sum + (typeof row[column.key] === "number" ? (row[column.key] as number) : 0),
        0,
      ),
    }));
  const totalByKey = new Map(totals.map((entry) => [entry.key, entry.total]));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Reports"
        description={`${report.rows.length} ${report.rows.length === 1 ? "row" : "rows"} in scope.`}
        actions={
          hasPermission(user, PERMISSIONS.REPORT_EXPORT) ? (
            <div className="flex gap-2">
              <ExportButton href={`/api/reports/export?${query.toString()}&format=csv`} label="Export CSV" />
              <ExportButton href={`/api/reports/export?${query.toString()}&format=pdf`} label="Export PDF" />
            </div>
          ) : undefined
        }
      />

      <ReportTabs reports={available} active={kind} />

      <Card>
        <CardContent className="py-4">
          <FilterBar
            fields={[
              { key: "from", label: "From", type: "date" },
              { key: "to", label: "To", type: "date" },
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
            ]}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        {report.rows.length === 0 ? (
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No data for this period.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  {report.columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={`whitespace-nowrap px-4 py-3 font-semibold ${
                        column.numeric ? "text-right" : "text-left"
                      }`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    {report.columns.map((column) => {
                      const value = row[column.key];
                      return (
                        <td
                          key={column.key}
                          className={`whitespace-nowrap px-4 py-2.5 ${
                            column.numeric
                              ? "text-right tabular-nums"
                              : "text-left"
                          }`}
                        >
                          {column.numeric && typeof value === "number"
                            ? formatMoney(value, grouping)
                            : String(value ?? "—")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  {report.columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={`whitespace-nowrap px-4 py-3 ${
                        column.numeric ? "text-right tabular-nums" : "text-left"
                      }`}
                    >
                      {index === 0
                        ? "Total"
                        : column.numeric
                          ? formatMoney(totalByKey.get(column.key) ?? 0, grouping)
                          : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
