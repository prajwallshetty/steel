"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityDialog } from "@/components/shared/EntityDialog";
import { toFiniteNumber } from "@/lib/quotation-engine/money";
import {
  vendorBillSchema,
  type VendorBillInput,
} from "@/modules/receipt-payment/receipt-payment-schema";
import { createVendorBillAction } from "@/modules/receipt-payment/receipt-payment-actions";

export function VendorBillDialog({
  branches,
  canSelectBranch,
  defaultBranchId,
}: {
  readonly branches: readonly { id: string; name: string }[];
  readonly canSelectBranch: boolean;
  readonly defaultBranchId: string | null;
}) {
  const form = useForm<VendorBillInput>({
    resolver: zodResolver(vendorBillSchema),
    defaultValues: {
      billNumber: "",
      vendorName: "",
      amount: 0,
      billDate: new Date().toISOString().slice(0, 10),
      branchId: defaultBranchId ?? "",
    },
  });

  const { register, formState, setValue, watch } = form;
  const errors = formState.errors;
  const amount = watch("amount");

  return (
    <EntityDialog
      trigger={
        <Button variant="outline">
          <FilePlus className="size-4" />
          Add Vendor Bill
        </Button>
      }
      title="Add Vendor Bill (Purchase Bill)"
      description="Records a purchase bill/invoice from a vendor so you can pay against it later."
      form={form}
      onSubmit={createVendorBillAction}
      successMessage="Vendor bill added successfully"
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="billNumber">Bill Number / Invoice No *</Label>
          <Input id="billNumber" {...register("billNumber")} placeholder="e.g. INV-2026-001" />
          {errors.billNumber && (
            <p className="text-xs text-destructive">{errors.billNumber.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendorName">Vendor Name *</Label>
          <Input id="vendorName" {...register("vendorName")} placeholder="e.g. ABC Traders" />
          {errors.vendorName && (
            <p className="text-xs text-destructive">{errors.vendorName.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="billDate">Bill Date *</Label>
            <Input id="billDate" type="date" {...register("billDate")} />
            {errors.billDate && (
              <p className="text-xs text-destructive">{errors.billDate.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Bill Amount (₹) *</Label>
            <Input
              id="amount"
              inputMode="decimal"
              value={String(amount ?? 0)}
              onChange={(e) =>
                setValue("amount", toFiniteNumber(e.target.value), {
                  shouldValidate: true,
                })
              }
              className="text-right tabular-nums"
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>
        </div>

        {canSelectBranch && (
          <div className="space-y-1.5">
            <Label htmlFor="branchId">Branch *</Label>
            <select
              id="branchId"
              {...register("branchId")}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Select a branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {errors.branchId && (
              <p className="text-xs text-destructive">{errors.branchId.message}</p>
            )}
          </div>
        )}
      </div>
    </EntityDialog>
  );
}
