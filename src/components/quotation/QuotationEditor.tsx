"use client";

import { useCallback, useMemo, useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Save, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { QuotationStatus } from "@/types/quotation";
import type { ActionResult } from "@/modules/shared/action-result";
import type { AppSettings } from "@/types/settings";
import { quotationDraftSchema } from "@/lib/validation/quotation-schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatQuantity } from "@/lib/format/number";
import { QuotationHeaderFields } from "./QuotationHeaderFields";
import { QuotationRowsGrid } from "./QuotationRowsGrid";
import { SheetViewport } from "./SheetViewport";
import { QuotationDocumentActions } from "./QuotationDocumentActions";
import { useLiveQuotation, type QuotationMetadata } from "./useLiveQuotation";

/**
 * Organisational context carried alongside the sheet itself. Kept in the same
 * form so a single submit persists the document and its ownership together.
 */
const editorSchema = quotationDraftSchema.extend({
  branchId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});

export type QuotationEditorValues = z.infer<typeof editorSchema>;

export interface OptionItem {
  readonly id: string;
  readonly name: string;
  readonly city?: string | null;
  readonly address?: string | null;
}

interface QuotationEditorProps {
  readonly initialDraft: QuotationEditorValues;
  readonly settings: AppSettings;
  readonly meta: QuotationMetadata;
  readonly mode: "create" | "edit";
  readonly onSave: (
    draft: QuotationEditorValues,
  ) => Promise<ActionResult<{ id: string }>>;
  readonly customers: readonly OptionItem[];
  readonly branches: readonly OptionItem[];
  readonly assignees: readonly OptionItem[];
  readonly canSelectBranch: boolean;
  readonly canAssign: boolean;
  /** Whether this user's saves go straight to approved, or need review. */
  readonly canApprove: boolean;
}

const NONE = "__none__";

interface ParsedDiaDiff {
  firstTier: number | null;
  secondTier: number | null;
  loading: number | null;
}

function parseBasicRate(label: string): number | null {
  const clean = label.trim();
  const dashMatch = clean.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (dashMatch) {
    const a = Number(dashMatch[1]);
    const b = Number(dashMatch[2]);
    return a - b;
  }
  const singleMatch = clean.match(/^(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    return Number(singleMatch[1]);
  }
  return null;
}

function parseDiaDiff(label: string): ParsedDiaDiff {
  const clean = label.trim().replace(/\s+/g, "");
  
  let loading: number | null = null;
  const loadingMatch = clean.match(/\+(\d+(?:\.\d+)?)$/);
  let basePart = clean;
  if (loadingMatch) {
    loading = Number(loadingMatch[1]);
    basePart = clean.slice(0, loadingMatch.index);
  }
  
  let firstTier: number | null = null;
  let secondTier: number | null = null;
  
  const slashMatch = basePart.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/);
  if (slashMatch) {
    firstTier = Number(slashMatch[1]);
    secondTier = Number(slashMatch[2]);
  } else {
    const singleMatch = basePart.match(/^(\d+(?:\.\d+)?)/);
    if (singleMatch) {
      firstTier = Number(singleMatch[1]);
    }
  }
  
  return { firstTier, secondTier, loading };
}

/**
 * The quotation editor.
 *
 * Owns the form but deliberately does not subscribe to its values: the grid,
 * the totals strip and the live sheet each watch only the slice they need, so
 * typing in a cell re-renders one input and the figures beside it rather than
 * the whole page.
 */
export function QuotationEditor({
  initialDraft,
  settings,
  meta,
  mode,
  onSave,
  customers,
  branches,
  assignees,
  canSelectBranch,
  canAssign,
  canApprove,
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
    reset,
    formState: { errors, isDirty },
  } = useForm<QuotationEditorValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: initialDraft,
    mode: "onBlur",
  });

  const basicRateLabelValue = useWatch({ control, name: "header.basicRateLabel" });

  const cdPercentValue = useWatch({ control, name: "header.cdPercent" });
  const diaDiffLabelValue = useWatch({ control, name: "header.diaDiffLabel" });

  const prevBasicRateLabel = useRef<string | undefined>(initialDraft.header.basicRateLabel);

  useEffect(() => {
    if (mode === "create") {
      const savedBasic = localStorage.getItem("steel_last_basic_rate");
      const savedDiff = localStorage.getItem("steel_last_rate_diff");
      if (savedBasic || savedDiff) {
        const defaultBasicVal = String(settings.pricing.defaultBasicRate + 4000);
        const finalBasic = savedBasic ?? defaultBasicVal;
        const finalDiff = savedDiff ?? "4000";
        const combined = `${finalBasic}-${finalDiff}`;
        const calculatedBasic = Math.max(0, parseBasicRate(combined) ?? 0);

        const currentValues = getValues();
        const updatedRows = (currentValues.rows || []).map((row) => ({
          ...row,
          basic: calculatedBasic,
        }));

        prevBasicRateLabel.current = combined;
        reset({
          ...currentValues,
          header: {
            ...currentValues.header,
            basicRateLabel: combined,
          },
          rows: updatedRows,
        });
      }
    }
  }, [mode, reset, settings]);
  useEffect(() => {
    if (basicRateLabelValue !== prevBasicRateLabel.current) {
      prevBasicRateLabel.current = basicRateLabelValue;
      if (basicRateLabelValue) {
        const calculatedBasic = parseBasicRate(basicRateLabelValue);
        if (calculatedBasic !== null) {
          const rows = getValues("rows") || [];
          rows.forEach((_, index) => {
            setValue(`rows.${index}.basic`, Math.max(0, calculatedBasic), { shouldDirty: true });
          });
        }
      }
    }
  }, [basicRateLabelValue, getValues, setValue]);

  const prevCdPercent = useRef<number | null | undefined>(initialDraft.header.cdPercent);
  useEffect(() => {
    if (cdPercentValue !== prevCdPercent.current) {
      prevCdPercent.current = cdPercentValue;
      const targetPercent = (cdPercentValue === undefined || cdPercentValue === null) ? 0 : cdPercentValue;
      const rows = getValues("rows") || [];
      rows.forEach((_, index) => {
        setValue(`rows.${index}.discountPercent`, targetPercent, { shouldDirty: true });
      });
    }
  }, [cdPercentValue, getValues, setValue]);


  const prevDiaDiffLabel = useRef<string | undefined>(initialDraft.header.diaDiffLabel);
  useEffect(() => {
    if (diaDiffLabelValue !== prevDiaDiffLabel.current) {
      prevDiaDiffLabel.current = diaDiffLabelValue;
      if (diaDiffLabelValue) {
        const { firstTier, secondTier, loading } = parseDiaDiff(diaDiffLabelValue);
        const differences = settings.differences;
        
        // Find default tiers from settings (non-zero differences, sorted descending)
        const defaultTiers = [
          ...new Set(
            settings.sizes
              .map((size) => differences[size] ?? 0)
              .filter((diff) => diff > 0),
          ),
        ].sort((a, b) => b - a);

        if (firstTier !== null) {
          const rows = getValues("rows") || [];
          rows.forEach((row, index) => {
            const defaultDiff = differences[row.size] ?? 0;
            if (defaultDiff > 0) {
              let newDiff = firstTier;
              if (secondTier !== null && defaultTiers.length > 1 && defaultDiff <= defaultTiers[1]) {
                newDiff = secondTier;
              }
              setValue(`rows.${index}.difference`, newDiff, { shouldDirty: true });
              
              if (loading !== null) {
                setValue(`rows.${index}.loading`, loading, { shouldDirty: true });
              }
            } else {
              setValue(`rows.${index}.difference`, 0, { shouldDirty: true });
              setValue(`rows.${index}.loading`, 0, { shouldDirty: true });
            }
          });
        }
      }
    }
  }, [diaDiffLabelValue, getValues, setValue, settings]);

  const submit = useCallback(
    (status: QuotationStatus) => {
      setPendingStatus(status);
      setValue("status", status, { shouldDirty: true });

      return handleSubmit(
        (values) => {
          if (
            status !== "DRAFT" &&
            !values.rows.some((row) => row.quantity > 0)
          ) {
            setPendingStatus(null);
            toast.error("Nothing to submit", {
              description:
                "Enter a quantity on at least one size before submitting.",
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
              status === "DRAFT"
                ? mode === "create"
                  ? "Draft created"
                  : "Draft saved"
                : canApprove
                  ? "Quotation submitted"
                  : "Sent for approval",
            );
            router.push(`/quotations/${result.data.id}`);
            router.refresh();
          });
        },
        () => {
          setPendingStatus(null);
          toast.error("Please fix the highlighted fields");
        },
      )();
    },
    [handleSubmit, mode, onSave, router, setValue, canApprove],
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit("DRAFT");
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Assignment</CardTitle>
          <CardDescription>
            Who this quotation belongs to. The party name printed on the sheet
            is a snapshot and will not change if the customer record is later
            renamed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {canSelectBranch && (
            <PickerField
              control={control}
              name="branchId"
              label="Branch"
              placeholder="Select a branch"
              options={branches}
              required
              error={errors.branchId?.message}
            />
          )}
          <PickerField
            control={control}
            name="customerId"
            label="Customer"
            placeholder="Not linked"
            options={customers}
            allowNone
            hint="Links the quotation to a customer record for reporting."
            setValue={setValue}
          />
          {canAssign && (
            <PickerField
              control={control}
              name="assignedToId"
              label="Assigned manager"
              placeholder="Unassigned"
              options={assignees}
              allowNone
            />
          )}
        </CardContent>
      </Card>

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
            setValue={setValue}
            getValues={getValues}
            customers={customers}
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
        <CardContent>
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

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t bg-background/95 px-4 sm:px-6 py-3 sm:py-4 backdrop-blur pb-safe z-30">
        {isDirty && (
          <span className="sm:mr-auto text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            Unsaved changes
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          onClick={() => void submit("DRAFT")}
          className="w-full sm:w-auto min-h-[44px]"
        >
          {isSaving && pendingStatus === "DRAFT" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Save />
          )}
          Save draft
        </Button>
        <Button
          type="button"
          disabled={isSaving}
          onClick={() => void submit("PENDING_APPROVAL")}
          className="w-full sm:w-auto min-h-[44px]"
        >
          {isSaving && pendingStatus === "PENDING_APPROVAL" ? (
            <Loader2 className="animate-spin" />
          ) : canApprove ? (
            <CheckCircle2 />
          ) : (
            <SendHorizonal />
          )}
          {canApprove ? "Submit" : "Send for approval"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------ sub-parts ------------------------------- */

function PickerField({
  control,
  name,
  label,
  placeholder,
  options,
  allowNone = false,
  required = false,
  hint,
  error,
  setValue,
}: {
  readonly control: any;
  readonly name: "branchId" | "customerId" | "assignedToId";
  readonly label: string;
  readonly placeholder: string;
  readonly options: readonly OptionItem[];
  readonly allowNone?: boolean;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string;
  readonly setValue?: any;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value || (allowNone ? NONE : "")}
            onValueChange={(value) => {
              const targetVal = value === NONE ? null : value;
              field.onChange(targetVal);
              if (name === "customerId" && setValue) {
                const selected = options.find((opt) => opt.id === targetVal);
                setValue("header.partyName", selected ? selected.name : "", {
                  shouldDirty: true,
                });
                if (selected) {
                  const loc = (selected.city || selected.address || "").trim();
                  if (loc) {
                    setValue("header.location", loc.toUpperCase(), {
                      shouldDirty: true,
                    });
                  }
                }
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={placeholder}>
                {() =>
                  field.value && field.value !== NONE
                    ? (options.find((opt) => opt.id === field.value)?.name || field.value)
                    : placeholder
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {allowNone && <SelectItem value={NONE}>{placeholder}</SelectItem>}
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface WatcherProps {
  readonly control: any;
  readonly settings: AppSettings;
  readonly meta: QuotationMetadata;
}

function TotalsStrip({ control, settings, meta }: WatcherProps) {
  const values = useWatch({ control }) as QuotationEditorValues;
  const quotation = useLiveQuotation(values, settings, meta);
  const { totals } = quotation;
  const grouping = settings.display.numberGrouping;

  const cells = useMemo(
    () => [
      {
        label: "Total quantity",
        value: `${formatQuantity(totals.totalQuantity)} MT`,
      },
      { label: "GST", value: formatMoney(totals.totalGst, grouping) },
      {
        label: "Cash discount",
        value: formatMoney(totals.totalDiscount, grouping),
      },
      {
        label: "Grand total",
        value: formatMoney(totals.grandTotal, grouping),
        emphasis: true,
      },
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

function LivePreview({ control, settings, meta }: WatcherProps) {
  const values = useWatch({ control }) as QuotationEditorValues;
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
