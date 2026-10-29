import type { Metadata } from "next";
import { Role } from "@prisma/client";
import { Users } from "lucide-react";
import { requirePermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import {
  listStaff,
  listStaffCollections,
  type StaffCollectionsPage,
} from "@/modules/staff/staff-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHeading } from "@/components/layout/PageHeading";
import { StaffDialog } from "@/components/staff/StaffDialog";
import { StaffPaymentDialog } from "@/components/staff/StaffPaymentDialog";
import { StaffRowActions } from "@/components/staff/StaffRowActions";

import { ExportButton } from "@/components/reports/ExportButton";

import { getActiveBranchFilter } from "@/modules/branches/branch-context";

export const metadata: Metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}

export default async function StaffPage({ searchParams }: PageProps) {
  const user = await requirePermission(PERMISSIONS.STAFF_VIEW);
  const params = await searchParams;

  const activeBranchId = await getActiveBranchFilter(user, params.branchId);
  const isSuper = user.role === Role.SUPER_ADMIN;

  const [staffMembers, branches] = await Promise.all([
    listStaff(user, { search: params.search, branchId: activeBranchId }),
    isSuper ? listSelectableBranches(user) : Promise.resolve([]),
  ]);

  // A failure here must not take down the staff list, but it must not be
  // swallowed either: the error is shown in place of the table.
  let collections: StaffCollectionsPage | null = null;
  let collectionsError: string | null = null;
  try {
    collections = await listStaffCollections(user, {
      search: params.csearch,
      staffId: params.cstaff,
      branchId: activeBranchId,
      paymentMethod: params.cmethod,
      from: params.cfrom,
      to: params.cto,
      page: Number(params.cpage) || 1,
    });
  } catch (error) {
    console.error("Failed to load staff collections", error);
    collectionsError = "Could not load collections. Please refresh and try again.";
  }

  const pageHref = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "cpage") q.set(k, v);
    q.set("cpage", String(n));
    return `/staff?${q.toString()}`;
  };
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const canCreate = hasPermission(user, PERMISSIONS.STAFF_CREATE);
  const canUpdate = hasPermission(user, PERMISSIONS.STAFF_UPDATE);
  const canDelete = hasPermission(user, PERMISSIONS.STAFF_DELETE);

  const branchOptions = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
  }));

  const staffOptions = staffMembers.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  const totalBalance = staffMembers.reduce((acc, s) => acc + (s.balance || 0), 0);

  const exportQuery = new URLSearchParams({ kind: "staff" });
  if (params.search) exportQuery.set("search", params.search);
  if (activeBranchId) exportQuery.set("branchId", activeBranchId);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="Staff"
        description={`${staffMembers.length} staff member${staffMembers.length === 1 ? "" : "s"} · Net Staff Balance: ${totalBalance < 0 ? `-₹${Math.abs(totalBalance).toLocaleString("en-IN")}` : `₹${totalBalance.toLocaleString("en-IN")}`}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton href={`/api/reports/export?${exportQuery.toString()}&format=csv`} label="Export CSV" />
            <ExportButton href={`/api/reports/export?${exportQuery.toString()}&format=pdf`} label="Export PDF" />
            {(canUpdate || canCreate) && (
              <StaffPaymentDialog staffList={staffOptions} />
            )}
          </div>
        }
      />

      {/* Cash in Hand Summary KPI Card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-card to-emerald-500/5 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cash in Hand / Net Balance</p>
              <p className={`text-2xl font-extrabold mt-0.5 tabular-nums ${totalBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {totalBalance < 0 ? `-₹${Math.abs(totalBalance).toLocaleString("en-IN")}` : `₹${totalBalance.toLocaleString("en-IN")}`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Sum of all active staff balances</p>
            </div>
            <Users className="size-6 text-emerald-500/60 shrink-0" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <FilterBar
            fields={[
              {
                key: "search",
                label: "Search",
                type: "search",
                placeholder: "Name, designation, phone…",
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
            ]}
          />
        </CardContent>
      </Card>

      {staffMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No staff members found</p>
              <p className="text-sm text-muted-foreground">
                Add staff members to track staff payments and advances.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Staff Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Designation</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Amount / Balance</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Contact</th>
                  {isSuper && (
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Branch</th>
                  )}
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {staffMembers.map((staff) => (
                  <tr
                    key={staff.id}
                    className="border-b transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <a
                        href={`/ledger?search=${encodeURIComponent(staff.name)}`}
                        className="hover:text-primary hover:underline"
                      >
                        {staff.name}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{staff.designation ?? "Staff"}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${staff.balance < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {staff.balance < 0 ? `-₹${Math.abs(staff.balance).toLocaleString("en-IN")}` : `₹${staff.balance.toLocaleString("en-IN")}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {staff.phone ?? "—"}
                      {staff.email && (
                        <span className="block text-xs">{staff.email}</span>
                      )}
                    </td>
                    {isSuper && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {staff.branchName}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <StaffDialog
                            staff={{
                              id: staff.id,
                              name: staff.name,
                              phone: staff.phone ?? "",
                              email: staff.email ?? "",
                              designation: staff.designation ?? "",
                              address: staff.address ?? "",
                              balance: staff.balance,
                              branchId: staff.branchId,
                            }}
                            branches={branchOptions}
                            canSelectBranch={false}
                            defaultBranchId={staff.branchId}
                          />
                        )}
                        {canDelete && (
                          <StaffRowActions
                            id={staff.id}
                            name={staff.name}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/60 font-bold border-t text-foreground">
                  <td colSpan={2} className="px-4 py-3 text-left">
                    Total Cash in Hand
                  </td>
                  <td className={`px-4 py-3 text-right text-base tabular-nums ${totalBalance < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {totalBalance < 0 ? `-₹${Math.abs(totalBalance).toLocaleString("en-IN")}` : `₹${totalBalance.toLocaleString("en-IN")}`}
                  </td>
                  <td colSpan={isSuper ? 3 : 2} className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Collections</h2>
              <p className="text-xs text-muted-foreground">
                Money received through staff members, newest first.
              </p>
            </div>
            {collections && (
              <p className="text-sm text-muted-foreground">
                {collections.total} record{collections.total === 1 ? "" : "s"} · Settled total{" "}
                <span className="font-semibold text-foreground tabular-nums">{inr(collections.totalAmount)}</span>
              </p>
            )}
          </div>
          <FilterBar
            fields={[
              { key: "csearch", label: "Search", type: "search", placeholder: "Reference, staff, customer…" },
              {
                key: "cstaff",
                label: "Staff",
                type: "select",
                options: staffMembers.map((s) => ({ value: s.id, label: s.name })),
              },
              {
                key: "cmethod",
                label: "Method",
                type: "select",
                options: ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "NEFT", "RTGS", "IMPS", "CARD"].map(
                  (m) => ({ value: m, label: m.replace(/_/g, " ") }),
                ),
              },
              { key: "cfrom", label: "From", type: "date" },
              { key: "cto", label: "To", type: "date" },
            ]}
          />

          {collectionsError ? (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {collectionsError}
            </p>
          ) : !collections || collections.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No collections found for the current filters.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-semibold">Reference</th>
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-left font-semibold">Staff</th>
                      <th className="px-3 py-2 text-left font-semibold">Customer</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      <th className="px-3 py-2 text-left font-semibold">Method</th>
                      <th className="px-3 py-2 text-left font-semibold">Txn / Ref No</th>
                      <th className="px-3 py-2 text-left font-semibold">Invoice</th>
                      <th className="px-3 py-2 text-left font-semibold">Notes</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.rows.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-2 font-medium">{c.reference}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {c.entryDate}
                          <span className="block text-xs">
                            {new Date(c.createdAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td className="px-3 py-2">{c.staffName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.customerName ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{inr(c.amount)}</td>
                        <td className="px-3 py-2">{c.paymentMethod.replace(/_/g, " ")}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.referenceNo ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.invoiceReference ?? "—"}</td>
                        <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground" title={[c.particular, c.note].filter(Boolean).join(" — ")}>
                          {[c.particular, c.note].filter(Boolean).join(" — ")}
                        </td>
                        <td className="px-3 py-2"><StatusBadge status={c.status} kind="ledger" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {collections.pageCount > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Page {collections.page} of {collections.pageCount}
                  </span>
                  <div className="flex gap-2">
                    {collections.page > 1 && (
                      <Link className="rounded-md border px-3 py-1 hover:bg-muted" href={pageHref(collections.page - 1)}>Previous</Link>
                    )}
                    {collections.page < collections.pageCount && (
                      <Link className="rounded-md border px-3 py-1 hover:bg-muted" href={pageHref(collections.page + 1)}>Next</Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
