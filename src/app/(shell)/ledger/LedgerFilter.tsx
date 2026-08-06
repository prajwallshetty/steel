"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LedgerFilter({
  customers,
}: {
  readonly customers: readonly { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const customerId = searchParams.get("customerId") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5 flex-1 min-w-[240px]">
        <Label htmlFor="customer-select" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Customer
        </Label>
        <Select
          value={customerId}
          onValueChange={(val) => updateParam("customerId", val ?? "")}
        >
          <SelectTrigger id="customer-select">
            <SelectValue placeholder="Choose customer..." />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-from" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          From Date
        </Label>
        <Input
          id="filter-from"
          type="date"
          value={from}
          onChange={(e) => updateParam("from", e.target.value)}
          className="w-44"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-to" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          To Date
        </Label>
        <Input
          id="filter-to"
          type="date"
          value={to}
          onChange={(e) => updateParam("to", e.target.value)}
          className="w-44"
        />
      </div>

      {pending && (
        <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
