import type { Metadata } from "next";
import { AuditAction, Role } from "@prisma/client";
import { requirePermission } from "@/modules/auth/guard";
import { PERMISSIONS } from "@/modules/permissions/permissions";
import {
  listAuditEntities,
  listAuditLog,
} from "@/modules/audit/audit-queries";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { formatTimestamp } from "@/lib/format/number";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";
import { AuditDiff } from "@/components/admin/AuditDiff";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const ACTION_TONE: Partial<Record<AuditAction, string>> = {
  CREATE: "text-emerald-700",
  UPDATE: "text-blue-700",
  DELETE: "text-red-700",
  APPROVE: "text-emerald-700",
  REJECT: "text-red-700",
  LOGIN_FAILED: "text-amber-700",
  PERMISSION_CHANGE: "text-purple-700",
};

export default async function AuditPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.AUDIT_VIEW);
  const params = await searchParams;

  const isSuper = user.role === Role.SUPER_ADMIN;

  const [rows, entities, branches] = await Promise.all([
    listAuditLog(user, {
      search: params.search,
      action: params.action as AuditAction | undefined,
      entity: params.entity,
      branchId: params.branchId,
      from: params.from,
      to: params.to,
    }),
    listAuditEntities(user),
    isSuper ? listSelectableBranches(user) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Audit log"
        description="Append-only record of every change. Nothing here can be edited or deleted, by anyone."
      />

      <Card>
        <CardContent className="py-4">
          <FilterBar
            fields={[
              {
                key: "search",
                label: "Search",
                type: "search",
                placeholder: "Summary, entity, user…",
              },
              {
                key: "action",
                label: "Action",
                type: "select",
                options: Object.values(AuditAction).map((action) => ({
                  value: action,
                  label: action.replace(/_/g, " ").toLowerCase(),
                })),
              },
              {
                key: "entity",
                label: "Entity",
                type: "select",
                options: entities.map((entity) => ({
                  value: entity,
                  label: entity,
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

      <Card className="overflow-hidden py-0">
        {rows.length === 0 ? (
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No audit entries match these filters.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">When</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Who</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Action</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Entity</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Summary</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Branch</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">IP</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Changes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                      {formatTimestamp(row.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">{row.userName}</td>
                    <td
                      className={`px-4 py-2.5 text-xs font-semibold capitalize ${
                        ACTION_TONE[row.action] ?? "text-muted-foreground"
                      }`}
                    >
                      {row.action.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {row.entity}
                    </td>
                    <td className="px-4 py-2.5">{row.summary}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {row.branchName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {row.ipAddress ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <AuditDiff
                        summary={row.summary}
                        oldValue={row.oldValue}
                        newValue={row.newValue}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
