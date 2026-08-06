"use client";

import { memo, useMemo } from "react";
import { Controller, useFieldArray, useWatch, type Control } from "react-hook-form";
import type { CalculatedRow } from "@/types/quotation";
import type { AppSettings } from "@/types/settings";
import { calculateRow, resolveHighlightedSizes } from "@/lib/quotation-engine";
import { formatMoney } from "@/lib/format/number";
import type { QuotationDraftInput } from "@/lib/validation/quotation-schema";
import { NumericCell } from "./NumericCell";
import { gridCellId, useGridNavigation } from "./useGridNavigation";
import { cn } from "@/lib/utils";

/** The editable columns, in tab order. Index here == grid column index. */
const EDITABLE_COLUMNS = [
  { field: "quantity", label: "Quantity", hint: "MT" },
  { field: "basic", label: "Basic", hint: "₹/MT" },
  { field: "difference", label: "Dia diff", hint: "₹/MT" },
  { field: "discountPercent", label: "CD", hint: "%" },
  { field: "loading", label: "Loading", hint: "₹/MT" },
  { field: "gstPercent", label: "GST", hint: "%" },
] as const;

interface QuotationRowsGridProps {
  readonly control: Control<QuotationDraftInput>;
  readonly settings: AppSettings;
  readonly disabled?: boolean;
}

/**
 * The Excel-like entry grid.
 *
 * Derived columns are recomputed from the watched rows on every change and
 * handed to memoised row components, so a keystroke re-renders one input and
 * the four read-only figures beside it rather than the whole editor.
 */
export function QuotationRowsGrid({
  control,
  settings,
  disabled = false,
}: QuotationRowsGridProps) {
  const { fields } = useFieldArray({ control, name: "rows" });
  const rows = useWatch({ control, name: "rows" }) as QuotationDraftInput["rows"];

  const { containerRef, handleKeyDown } = useGridNavigation(
    fields.length,
    EDITABLE_COLUMNS.length,
  );

  const calculated = useMemo<CalculatedRow[]>(() => {
    if (!rows) return [];
    const highlighted = resolveHighlightedSizes(rows, settings.highlightSizes);
    return rows.map((row) =>
      calculateRow(row, {
        discountBase: settings.pricing.discountBase,
        highlighted: row.highlight ?? highlighted.has(row.size),
      }),
    );
  }, [rows, settings.highlightSizes, settings.pricing.discountBase]);

  const grouping = settings.display.numberGrouping;

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="overflow-x-auto rounded-lg border"
    >
      <table className="w-full min-w-[1000px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Size
            </th>
            {EDITABLE_COLUMNS.map((column) => (
              <th
                key={column.field}
                scope="col"
                className="px-3 py-2 text-right font-semibold"
              >
                {column.label}
                <span className="ml-1 font-normal normal-case opacity-60">
                  {column.hint}
                </span>
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              CD amt
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              GST amt
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Rate
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Line total
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <GridRow
              key={field.id}
              control={control}
              index={index}
              size={field.size}
              calculated={calculated[index]}
              grouping={grouping}
              disabled={disabled}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface GridRowProps {
  readonly control: Control<QuotationDraftInput>;
  readonly index: number;
  readonly size: string;
  readonly calculated: CalculatedRow | undefined;
  readonly grouping: AppSettings["display"]["numberGrouping"];
  readonly disabled: boolean;
}

const GridRow = memo(function GridRow({
  control,
  index,
  size,
  calculated,
  grouping,
  disabled,
}: GridRowProps) {
  const money = (value: number | undefined) =>
    formatMoney(value ?? 0, grouping);

  return (
    <tr
      className={cn(
        "border-b last:border-b-0",
        calculated?.isHighlighted && "bg-emerald-50/70",
      )}
    >
      <th
        scope="row"
        className="whitespace-nowrap px-3 py-1.5 text-left font-semibold"
      >
        {size}
      </th>

      {EDITABLE_COLUMNS.map((column, columnIndex) => (
        <td key={column.field} className="px-1.5 py-1.5">
          <Controller
            control={control}
            name={`rows.${index}.${column.field}`}
            render={({ field, fieldState }) => (
              <NumericCell
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={disabled}
                invalid={Boolean(fieldState.error)}
                gridCell={gridCellId(index, columnIndex)}
                ariaLabel={`${size} ${column.label}`}
              />
            )}
          />
        </td>
      ))}

      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
        {money(calculated?.discountAmount)}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
        {money(calculated?.gstAmount)}
      </td>
      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
        {money(calculated?.rate)}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums">
        {calculated && calculated.quantity > 0 ? (
          money(calculated.total)
        ) : (
          <span className="text-muted-foreground">{money(0)}</span>
        )}
      </td>
    </tr>
  );
});
