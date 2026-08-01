import type { Metadata } from "next";
import { Role } from "@prisma/client";
import { requirePermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import { getSettings } from "@/modules/settings/settings-service";
import { createQuotationAction } from "@/modules/quotations/quotation-actions";
import { listSelectableCustomers } from "@/modules/customers/customer-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { listAssignableUsers } from "@/modules/users/user-service";
import { createEmptyDraft } from "@/lib/quotation/factory";
import { QuotationEditor } from "@/components/quotation/QuotationEditor";
import { PageHeading } from "@/components/layout/PageHeading";

export const metadata: Metadata = { title: "New quotation" };
export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const user = await requirePermission(PERMISSIONS.QUOTATION_CREATE);

  const canSelectBranch = user.role === Role.SUPER_ADMIN;
  const canAssign = hasPermission(user, PERMISSIONS.QUOTATION_ASSIGN);

  const [settings, customers, branches, assignees] = await Promise.all([
    getSettings(user.branchId),
    listSelectableCustomers(user, user.branchId ?? undefined),
    canSelectBranch ? listSelectableBranches(user) : Promise.resolve([]),
    canAssign && user.branchId
      ? listAssignableUsers(user, user.branchId)
      : Promise.resolve([]),
  ]);

  const draft = createEmptyDraft(settings);
  const now = new Date().toISOString();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title="New quotation"
        description="Rates and sizes are seeded from master settings. Everything can be overridden per row."
        backHref="/quotations"
        backLabel="All quotations"
      />

      <QuotationEditor
        mode="create"
        settings={settings}
        initialDraft={{
          ...draft,
          branchId: user.branchId,
          customerId: null,
          assignedToId: user.role === Role.MANAGER ? user.id : null,
        }}
        meta={{
          id: "draft",
          // Allocated on save; the preview shows a placeholder until then.
          reference: "NEW",
          createdBy: user.name,
          createdAt: now,
          updatedAt: now,
        }}
        onSave={createQuotationAction}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        branches={branches.map((b) => ({ id: b.id, name: `${b.name} (${b.code})` }))}
        assignees={assignees.map((a) => ({ id: a.id, name: a.name }))}
        canSelectBranch={canSelectBranch}
        canAssign={canAssign}
        canApprove={hasPermission(user, PERMISSIONS.QUOTATION_APPROVE)}
      />
    </div>
  );
}
