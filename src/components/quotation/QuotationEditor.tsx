"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { QuotationStatus } from "@/types/quotation";
import type { SaveResult } from "@/types/actions";
import type { AppSettings } from "@/types/settings";
import {
  quotationDraftSchema,
  type QuotationDraftInput,
} from "@/lib/validation/quotation-schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatMoney, formatQuantity } from "@/lib/format/number";
import { QuotationHeaderFields } from "./QuotationHeaderFields";
import { QuotationRowsGrid } from "./QuotationRowsGrid";
import { SheetViewport } from "./SheetViewport";
import { QuotationDocumentActions } from "./QuotationDocumentActions";
import { useLiveQuotation, type QuotationMetadata } from "./useLiveQuotation";

interface QuotationEditorProps {
  readonly initialDraft: QuotationDraftInput;
  readonly settings: AppSettings;
  readonly meta: QuotationMetadata;
  readonly mode: "create" | "edit";
  readonly onSave: (draft: QuotationDraftInput) => Promise<SaveResult>;
}

/**
 * The quotation editor.
 *
 * Owns the form; deliberately does not subscribe to its values. The grid, the
 * totals strip and the live sheet each watch the slice they need, so typing in
 * a cell never re-renders the whole page.
 */
export function QuotationEditor({
  initialDraft,
  settings,
  meta,
  mode,
  onSave,
}: QuotationEditorProps) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<QuotationStatus | null>(
    null,
  );

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<QuotationDraftInput>({
    resolver: zodResolver(quotationDraftSchema),
    defaultValues: initialDraft,
    mode: "onBlur",
  });

  const submit = useCallback(
    (status: QuotationStatus) => {
      setPendingStatus(status);
      setValue("status", status, { shouldDirty: true });

      return handleSubmit(
        (values) => {
          if (
            status === "finalized" &&
            !values.rows.some((row) => row.quantity > 0)
          ) {
            setPendingStatus(null);
            toast.error("Nothing to finalize", {
              description:
                "Enter a quantity on at least one size before finalizing.",
            });
            return;
          }

          startSaving(async () => {
            const result = await onSave({ ...values, status });
            setPendingStatus(null);

            if (!result.ok) {
              toast.error("Could not save", { description: result.error });
              return;
            }

            toast.success(
              status === "finalized"
                ? "Quotation finalized"
                : mode === "create"
                  ? "Draft created"
                  : "Draft saved",
            );
            router.push(`/quotations/${result.id}`);
            router.refresh();
          });
        },
        () => {
          setPendingStatus(null);
          toast.error("Please fix the highlighted fields");
        },
      )();
    },
    [handleSubmit, mode, onSave, router, setValue],
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit("draft");
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Quotation details</CardTitle>
          <CardDescription>
            These fields fill the merged header block at the top of the sheet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuotationHeaderFields
            control={control}
            errors={errors}
            settings={settings}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Material rates</CardTitle>
          <CardDescription>
            Arrow keys move between cells, Enter drops to the next row, Tab
            moves across. Totals update as you type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <QuotationRowsGrid control={control} settings={settings} />
          {errors.rows?.message && (
            <p className="text-sm text-destructive">{errors.rows.message}</p>
          )}
          <TotalsStrip control={control} settings={settings} meta={meta} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Footer note</CardTitle>
          <CardDescription>
            Printed beneath the grid, prefixed with “NOTE:”.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label htmlFor="remarks" className="sr-only">
            Footer note
          </Label>
          <Textarea
            id="remarks"
            rows={2}
            defaultValue={getValues("remarks")}
            onChange={(event) =>
              setValue("remarks", event.target.value, { shouldDirty: true })
            }
          />
        </CardContent>
      </Card>

      <LivePreview control={control} settings={settings} meta={meta} />

      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur">
        {isDirty && (
          <span className="mr-auto text-sm text-muted-foreground">
            Unsaved changes
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          onClick={() => void submit("draft")}
        >
          {isSaving && pendingStatus === "draft" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Save />
          )}
          Save draft
        </Button>
        <Button
          type="button"
          disabled={isSaving}
          onClick={() => void submit("finalized")}
        >
          {isSaving && pendingStatus === "finalized" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <CheckCircle2 />
          )}
          Finalize
        </Button>
      </div>
    </form>
  );
}

interface WatcherProps {
  readonly control: Control<QuotationDraftInput>;
  readonly settings: AppSettings;
  readonly meta: QuotationMetadata;
}

/** Running totals under the grid. */
function TotalsStrip({ control, settings, meta }: WatcherProps) {
  const values = useWatch({ control }) as QuotationDraftInput;
  const quotation = useLiveQuotation(values, settings, meta);
  const { totals } = quotation;
  const grouping = settings.display.numberGrouping;

  const cells = useMemo(
    () => [
      { label: "Total quantity", value: `${formatQuantity(totals.totalQuantity)} MT` },
      { label: "GST", value: formatMoney(totals.totalGst, grouping) },
      { label: "Cash discount", value: formatMoney(totals.totalDiscount, grouping) },
      { label: "Grand total", value: formatMoney(totals.grandTotal, grouping), emphasis: true },
    ],
    [totals, grouping],
  );

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {cell.label}
          </p>
          <p
            className={
              cell.emphasis
                ? "text-xl font-bold tabular-nums text-red-600"
                : "text-xl font-semibold tabular-nums"
            }
          >
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/** The facsimile, kept in sync with the form on every keystroke. */
function LivePreview({ control, settings, meta }: WatcherProps) {
  const values = useWatch({ control }) as QuotationDraftInput;
  const quotation = useLiveQuotation(values, settings, meta);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Live preview</CardTitle>
          <CardDescription>
            Exactly what prints — A4 landscape, 10&nbsp;mm margins.
          </CardDescription>
        </div>
        <QuotationDocumentActions quotation={quotation} settings={settings} />
      </CardHeader>
      <CardContent>
        <div className="steel-sheet-scroll rounded-lg">
          <SheetViewport quotation={quotation} settings={settings} />
        </div>
      </CardContent>
    </Card>
  );
}
