"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
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

/**
 * URL-driven filters.
 *
 * State lives in the query string rather than component state, so a filtered
 * view is shareable, survives a refresh, and lets the server do the filtering —
 * which is also what keeps scoping enforced on the server rather than in the
 * browser.
 */
export function FilterBar({
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
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {field.label}
            </Label>

            {field.type === "select" ? (
              <Select
                value={searchParams.get(field.key) ?? ALL}
                // Base UI reports a null value when the selection is cleared.
                onValueChange={(value) => apply(field.key, value ?? ALL)}
              >
                <SelectTrigger id={`filter-${field.key}`} className="w-48">
                  <SelectValue />
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
              <Input
                id={`filter-${field.key}`}
                type={field.type === "date" ? "date" : "search"}
                defaultValue={searchParams.get(field.key) ?? ""}
                placeholder={field.placeholder}
                className={field.type === "date" ? "w-44" : "w-64"}
                // Search applies on blur/Enter rather than per keystroke, so a
                // long query does not fire a request per character.
                onBlur={(event) => apply(field.key, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    apply(field.key, event.currentTarget.value);
                  }
                }}
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
            <X />
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
