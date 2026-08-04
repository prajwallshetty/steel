import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { requireAnyPermission } from "@/modules/auth/guard";
import { PERMISSIONS, hasPermission } from "@/modules/permissions/permissions";
import { getQuotation } from "@/modules/quotations/quotation-service";
import { getSettings } from "@/modules/settings/settings-service";
import { calculateQuotation } from "@/lib/quotation-engine";
import { EDITABLE_STATUSES } from "@/types/quotation";
import { formatTimestamp } from "@/lib/format/number";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeading } from "@/components/layout/PageHeading";
import { QuotationSheet } from "@/components/quotation/QuotationSheet";
import { QuotationDocumentActions } from "@/components/quotation/QuotationDocumentActions";
import { QuotationWorkflowActions } from "@/components/quotation/QuotationWorkflowActions";
import { QuotationStatusSelector } from "@/components/quotation/QuotationStatusSelector";

export const dynamic = "force-dynamic";

const VIEW_PERMISSIONS = [
  PERMISSIONS.QUOTATION_VIEW_ALL,
  PERMISSIONS.QUOTATION_VIEW_BRANCH,
  PERMISSIONS.QUOTATION_VIEW_OWN,
] as const;

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Quotation ${id.slice(0, 6)}` };
}

export default async function QuotationPreviewPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAnyPermission(VIEW_PERMISSIONS);

  const quotation = await getQuotation(user, id);
  if (!quotation) notFound();

  const settings = await getSettings(quotation.ownership?.branchId);
  const calculated = calculateQuotation(quotation, settings);

  const editable = EDITABLE_STATUSES.includes(quotation.status);
  const canEdit =
    editable && hasPermission(user, PERMISSIONS.QUOTATION_UPDATE_OWN);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title={quotation.reference}
        description={`${quotation.header.partyName} · ${quotation.header.brand} · ${quotation.header.location}`}
        backHref="/quotations"
        backLabel="All quotations"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <QuotationStatusSelector id={id} currentStatus={quotation.status} />
            {canEdit && (
              <Button
                variant="outline"
                render={<Link href={`/quotations/${id}/edit`} />}
              >
                <Pencil />
                Edit
              </Button>
            )}
            <QuotationDocumentActions
              quotation={calculated}
              settings={settings}
              printHref={`/quotations/${id}/print`}
            />
          </div>
        }
      />

      {quotation.status === "REJECTED" && quotation.ownership?.rejectionReason && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span className="font-semibold">Rejected:</span>{" "}
          {quotation.ownership.rejectionReason}
        </p>
      )}

      {!editable && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This quotation is {quotation.status.replace(/_/g, " ").toLowerCase()}{" "}
          and can no longer be edited. Duplicate it to make changes.
        </p>
      )}

      <Card className="overflow-hidden py-0">
        <div className="steel-sheet-scroll">
          <div className="steel-sheet-paper">
            <QuotationSheet quotation={calculated} settings={settings} />
          </div>
        </div>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-6 py-5 text-sm">
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <Fact label="Branch" value={quotation.ownership?.branchName ?? "—"} />
            <Fact
              label="Assigned to"
              value={quotation.ownership?.assignedToName ?? "Unassigned"}
            />
            <Fact label="Created by" value={quotation.createdBy} />
            <Fact label="Created" value={formatTimestamp(quotation.createdAt)} />
            <Fact label="Updated" value={formatTimestamp(quotation.updatedAt)} />
            {quotation.ownership?.approvedByName && (
              <Fact
                label="Approved by"
                value={`${quotation.ownership.approvedByName}${
                  quotation.ownership.approvedAt
                    ? ` · ${formatTimestamp(quotation.ownership.approvedAt)}`
                    : ""
                }`}
              />
            )}
          </dl>

          <QuotationWorkflowActions
            id={id}
            status={quotation.status}
            canApprove={hasPermission(user, PERMISSIONS.QUOTATION_APPROVE)}
            canDelete={hasPermission(user, PERMISSIONS.QUOTATION_DELETE)}
            canCreate={hasPermission(user, PERMISSIONS.QUOTATION_CREATE)}
            canEdit={hasPermission(user, PERMISSIONS.QUOTATION_UPDATE_OWN)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
