"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LedgerFilter({
  customers,
  vendors,
}: {
  readonly customers: readonly { id: string; name: string }[];
  readonly vendors: readonly { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const partyType = searchParams.get("partyType") ?? "customer";
  const customerId = searchParams.get("customerId") ?? "";
  const vendorId = searchParams.get("vendorId") ?? "";
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

  const handlePartyTypeChange = (newType: string | null) => {
    if (!newType) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("partyType", newType);
    params.delete("customerId");
    params.delete("vendorId");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Party Type Selector */}
      <div className="space-y-1.5 min-w-[120px]">
        <Label htmlFor="party-type" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Type
        </Label>
        <Select value={partyType} onValueChange={handlePartyTypeChange}>
          <SelectTrigger id="party-type">
            <SelectValue placeholder="Select type...">
              {() => partyType === "vendor" ? "Vendor" : "Customer"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selected Entity Dropdown */}
      <div className="space-y-1.5 flex-1 min-w-[240px]">
        <Label htmlFor="party-select" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {partyType === "vendor" ? "Vendor" : "Customer"}
        </Label>
        {partyType === "vendor" ? (
          <Select
            key="vendor-select"
            value={vendorId}
            onValueChange={(val) => updateParam("vendorId", val ?? "")}
          >
            <SelectTrigger id="party-select">
              <SelectValue placeholder="Choose vendor...">
                {() => vendors.find((v) => v.id === vendorId)?.name || "Choose vendor..."}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            key="customer-select"
            value={customerId}
            onValueChange={(val) => updateParam("customerId", val ?? "")}
          >
            <SelectTrigger id="party-select">
              <SelectValue placeholder="Choose customer...">
                {() => customers.find((c) => c.id === customerId)?.name || "Choose customer..."}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
