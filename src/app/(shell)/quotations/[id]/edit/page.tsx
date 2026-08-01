import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Role } from "@prisma/client";
import { requirePermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import { getSettings } from "@/modules/settings/settings-service";
import { getQuotation } from "@/modules/quotations/quotation-service";
import { updateQuotationAction } from "@/modules/quotations/quotation-actions";
import { listSelectableCustomers } from "@/modules/customers/customer-service";
import { listSelectableBranches } from "@/modules/branches/branch-service";
import { listAssignableUsers } from "@/modules/users/user-service";
import { EDITABLE_STATUSES } from "@/types/quotation";
import { QuotationEditor } from "@/components/quotation/QuotationEditor";
import { PageHeading } from "@/components/layout/PageHeading";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Edit quotation ${id.slice(0, 6)}` };
}

export default async function EditQuotationPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.QUOTATION_UPDATE_OWN);

  const quotation = await getQuotation(user, id);
  if (!quotation) notFound();

  // Approved documents are a record of a commitment. Bouncing here avoids
  // rendering a form that the service would refuse to save anyway.
  if (!EDITABLE_STATUSES.includes(quotation.status)) {
    redirect(`/quotations/${id}`);
  }

  const branchId = quotation.ownership?.branchId ?? user.branchId;
  const canSelectBranch = user.role === Role.SUPER_ADMIN;
  const canAssign = hasPermission(user, PERMISSIONS.QUOTATION_ASSIGN);

  const [settings, customers, branches, assignees] = await Promise.all([
    getSettings(branchId),
    listSelectableCustomers(user, branchId ?? undefined),
    canSelectBranch ? listSelectableBranches(user) : Promise.resolve([]),
    canAssign && branchId
      ? listAssignableUsers(user, branchId)
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title={`Edit ${quotation.reference}`}
        description={quotation.header.partyName}
        backHref={`/quotations/${id}`}
        backLabel="Back to quotation"
      />

      <QuotationEditor
        mode="edit"
        settings={settings}
        initialDraft={{
          status: quotation.status,
          header: quotation.header,
          rows: quotation.rows.map((row) => ({ ...row })),
          remarks: quotation.remarks,
          branchId: quotation.ownership?.branchId ?? null,
          customerId: quotation.ownership?.customerId ?? null,
          assignedToId: quotation.ownership?.assignedToId ?? null,
        }}
        meta={{
          id: quotation.id,
          reference: quotation.reference,
          createdBy: quotation.createdBy,
          createdAt: quotation.createdAt,
          updatedAt: quotation.updatedAt,
        }}
        onSave={updateQuotationAction.bind(null, id)}
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
