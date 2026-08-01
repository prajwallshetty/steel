import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { quotationRepository, settingsRepository } from "@/lib/repository";
import { calculateQuotation } from "@/lib/quotation-engine";
import {
  deleteQuotationAction,
  duplicateQuotationAction,
} from "@/lib/actions/quotations";
import { formatTimestamp } from "@/lib/format/number";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/layout/PageHeading";
import { QuotationSheet } from "@/components/quotation/QuotationSheet";
import { QuotationDocumentActions } from "@/components/quotation/QuotationDocumentActions";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const quotation = await quotationRepository.findById(id);
  return {
    title: quotation
      ? `${quotation.reference} · ${quotation.header.partyName}`
      : "Quotation",
  };
}

export default async function QuotationPreviewPage({ params }: PageProps) {
  const { id } = await params;
  const [quotation, settings] = await Promise.all([
    quotationRepository.findById(id),
    settingsRepository.get(),
  ]);

  if (!quotation) notFound();

  const calculated = calculateQuotation(quotation, settings);
  const isFinalized = quotation.status === "finalized";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeading
        title={quotation.reference}
        description={`${quotation.header.partyName} · ${quotation.header.brand} · ${quotation.header.location}`}
        backHref="/quotations"
        backLabel="All quotations"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isFinalized ? "default" : "secondary"}>
              {isFinalized ? "Finalized" : "Draft"}
            </Badge>

            {!isFinalized && (
              <Button
                variant="outline"
                render={<Link href={`/quotations/${quotation.id}/edit`} />}
              >
                <Pencil />
                Edit
              </Button>
            )}

            <form action={duplicateQuotationAction.bind(null, quotation.id)}>
              <Button type="submit" variant="outline">
                <Copy />
                Duplicate
              </Button>
            </form>

            <QuotationDocumentActions
              quotation={calculated}
              settings={settings}
              printHref={`/quotations/${quotation.id}/print`}
            />
          </div>
        }
      />

      {isFinalized && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This quotation is finalized and immutable. Duplicate it to make
          changes.
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
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Created by
              </dt>
              <dd className="font-medium">{quotation.createdBy}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Created
              </dt>
              <dd className="font-medium">
                {formatTimestamp(quotation.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Last updated
              </dt>
              <dd className="font-medium">
                {formatTimestamp(quotation.updatedAt)}
              </dd>
            </div>
          </dl>

          <form action={deleteQuotationAction.bind(null, quotation.id)}>
            <Button type="submit" variant="ghost" className="text-destructive">
              <Trash2 />
              Delete
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
