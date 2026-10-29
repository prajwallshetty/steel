"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityDialog } from "@/components/shared/EntityDialog";
import { toFiniteNumber } from "@/lib/quotation-engine/money";
import {
  vendorBillUpdateSchema,
  type VendorBillUpdateInput,
} from "@/modules/receipt-payment/receipt-payment-schema";
import { updateVendorBillAction } from "@/modules/receipt-payment/receipt-payment-actions";

export function VendorBillEditDialog({
  bill,
}: {
  readonly bill: {
    readonly id: string;
    readonly billNumber: string;
    readonly vendorName: string;
    readonly billDate: string;
    readonly amount: number;
  };
}) {
  const form = useForm<VendorBillUpdateInput>({
    resolver: zodResolver(vendorBillUpdateSchema),
    defaultValues: {
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      amount: bill.amount,
    },
  });
  const { register, formState, setValue, watch } = form;
  const errors = formState.errors;
  const amount = watch("amount");

  return (
    <EntityDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit bill ${bill.billNumber}`}
          title="Edit bill"
        >
          <Pencil className="size-4" />
        </Button>
      }
      title={`Edit bill ${bill.billNumber}`}
      description="Correct the bill details. The vendor cannot be changed, and the amount cannot be lower than payments already made against the bill."
      form={form}
      onSubmit={(values) => updateVendorBillAction(bill.id, values)}
      successMessage="Bill updated"
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <Label>
            Vendor <span className="text-xs font-normal text-muted-foreground">(read-only)</span>
          </Label>
          <p className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm">{bill.vendorName}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-billNumber">Bill Number / Invoice No *</Label>
          <Input id="edit-billNumber" {...register("billNumber")} />
          {errors.billNumber && (
            <p className="text-xs text-destructive">{errors.billNumber.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-billDate">Bill Date *</Label>
            <Input id="edit-billDate" type="date" {...register("billDate")} />
            {errors.billDate && (
              <p className="text-xs text-destructive">{errors.billDate.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-amount">Bill Amount (₹) *</Label>
            <Input
              id="edit-amount"
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
      </div>
    </EntityDialog>
  );
}
