"use client";

import { memo, useState, type FocusEvent } from "react";
import { cn } from "@/lib/utils";
import { toFiniteNumber } from "@/lib/quotation-engine/money";

interface NumericCellProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly onBlur?: () => void;
  readonly gridCell: string;
  readonly ariaLabel: string;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly step?: number;
  readonly className?: string;
}

/**
 * A numeric grid cell.
 *
 * While focused the raw keystrokes are held in a local buffer so intermediate
 * states like `"1."` or `""` survive long enough to finish typing, but the
 * parsed number is pushed upward on every change — that is what keeps the
 * totals live. On blur the buffer is dropped and the canonical value renders.
 */
export const NumericCell = memo(function NumericCell({
  value,
  onChange,
  onBlur,
  gridCell,
  ariaLabel,
  invalid = false,
  disabled = false,
  step,
  className,
}: NumericCellProps) {
  const [buffer, setBuffer] = useState<string | null>(null);

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  const handleBlur = () => {
    setBuffer(null);
    onBlur?.();
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      step={step}
      data-grid-cell={gridCell}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      value={buffer ?? String(value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={(event) => {
        setBuffer(event.target.value);
        onChange(toFiniteNumber(event.target.value));
      }}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums",
        "transition-colors outline-none",
        "focus:border-primary focus:ring-2 focus:ring-primary/20",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        invalid && "border-destructive focus:border-destructive focus:ring-destructive/20",
        className,
      )}
    />
  );
});
