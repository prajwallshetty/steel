"use client";

import { memo, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterField {
  readonly key: string;
  readonly label: string;
  readonly type: "search" | "date" | "select";
  readonly options?: readonly { value: string; label: string }[];
  readonly placeholder?: string;
}

const ALL = "__all__";

function SearchFilterInput({
  field,
  initialValue,
  onApply,
}: {
  readonly field: FilterField;
  readonly initialValue: string;
  readonly onApply: (key: string, value: string) => void;
}) {
  const [val, setVal] = useState(initialValue);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (val === initialValue) return;
    const timer = setTimeout(() => {
      onApply(field.key, val);
    }, 250);
    return () => clearTimeout(timer);
  }, [val, initialValue, field.key, onApply]);

  return (
    <Input
      id={`filter-${field.key}`}
      type={field.type === "date" ? "date" : "search"}
      value={val}
      placeholder={field.placeholder}
      className={field.type === "date" ? "w-44" : "w-64"}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onApply(field.key, val);
        }
      }}
    />
  );
}

function FilterBarComponent({
  fields,
  className,
}: {
  readonly fields: readonly FilterField[];
  readonly className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === ALL) params.delete(key);
      else params.set(key, value);
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  const hasFilters = fields.some((field) => searchParams.get(field.key));

  return (
    <div className={className}>
      <div className="flex flex-wrap items-end gap-3">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label
              htmlFor={`filter-${field.key}`}
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground select-none"
            >
              {field.label}
            </Label>

            {field.type === "select" ? (
              <Select
                value={searchParams.get(field.key) ?? ALL}
                onValueChange={(value) => apply(field.key, value ?? ALL)}
              >
                <SelectTrigger id={`filter-${field.key}`} className="w-48">
                  <SelectValue>
                    {() => {
                      const currentValue = searchParams.get(field.key) ?? ALL;
                      if (currentValue === ALL) {
                        return field.placeholder ?? `All ${field.label.toLowerCase()}`;
                      }
                      return field.options?.find((opt) => opt.value === currentValue)?.label ?? currentValue;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>
                    {field.placeholder ?? `All ${field.label.toLowerCase()}`}
                  </SelectItem>
                  {field.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <SearchFilterInput
                field={field}
                initialValue={searchParams.get(field.key) ?? ""}
                onApply={apply}
              />
            )}
          </div>
        ))}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              startTransition(() => {
                router.replace(pathname);
              })
            }
          >
            <X className="size-4" />
            Clear
          </Button>
        )}

        {pending && (
          <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

export const FilterBar = memo(FilterBarComponent);

