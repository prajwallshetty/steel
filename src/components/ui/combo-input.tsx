"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ComboInputProps
  extends Omit<React.ComponentProps<"input">, "list" | "value" | "onChange"> {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly string[];
}

/**
 * A text field with suggestions.
 *
 * Brands, locations and payment terms are maintained in Admin, but the trade
 * routinely needs a one-off value on a single quotation. A native datalist
 * gives the dropdown without forbidding the free-text entry that a strict
 * select would.
 */
export function ComboInput({
  value,
  onValueChange,
  options,
  className,
  ...props
}: ComboInputProps) {
  const listId = useId();

  return (
    <>
      <Input
        {...props}
        list={listId}
        value={value}
        autoComplete="off"
        onChange={(event) => onValueChange(event.target.value)}
        className={cn("uppercase", className)}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}
