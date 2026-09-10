"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityDialog } from "@/components/shared/EntityDialog";
import { toFiniteNumber } from "@/lib/quotation-engine/money";
import { formatMoney } from "@/lib/format/number";
import {
  PAYMENT_METHODS,
} from "@/modules/ledger/ledger-schema";
import {
  partnerPaymentSchema,
  type PartnerPaymentInput,
} from "@/modules/receipt-payment/receipt-payment-schema";
import {
  createPartnerPaymentAction,
  updatePartnerPaymentAction,
} from "@/modules/receipt-payment/partner-payment-actions";

export interface VendorPaymentEditValues
  extends Omit<PartnerPaymentInput, "partnerType" | "branchId"> {
  readonly id: string;
}

export function VendorPaymentDialog({
  payment,
  vendors,
  branches,
  canSelectBranch,
  defaultBranchId,
}: {
  readonly payment?: VendorPaymentEditValues;
  readonly vendors: readonly { id: string; name: string }[];
  readonly branches: readonly { id: string; name: string }[];
  readonly canSelectBranch: boolean;
  readonly defaultBranchId: string | null;
}) {
  const editing = Boolean(payment?.id);

  const form = useForm<PartnerPaymentInput>({
    resolver: zodResolver(partnerPaymentSchema),
    defaultValues: {
      entryDate: payment?.entryDate ?? new Date().toISOString().slice(0, 10),
      direction: payment?.direction ?? "DEBIT",
      partnerType: "VENDOR",
      partnerId: payment?.partnerId ?? "",
      amount: payment?.amount ?? 0,
      paymentMethod: payment?.paymentMethod ?? "CASH",
      referenceNo: payment?.referenceNo ?? "",
      particular: payment?.particular ?? "",
      note: payment?.note ?? "",
      branchId: defaultBranchId ?? "",
    },
  });

  const { register, formState, setValue, watch } = form;
  const errors = formState.errors;

  const amount = watch("amount");

  return (
    <EntityDialog
      trigger={
        editing ? (
          <Button variant="ghost" size="icon" aria-label="Edit vendor payment" title="Edit payment">
            <Pencil className="size-4 text-muted-foreground hover:text-foreground" />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Record Vendor Payment
          </Button>
        )
      }
      title={editing ? "Edit Vendor Payment" : "Record Vendor Payment"}
      description={
        editing
          ? "Update this vendor payment. The voucher number and vendor ledger stay linked to this same record."
          : "Record vendor payments (money out) and vendor refunds (money in)."
      }
      form={form}
      onSubmit={(values) =>
        editing
          ? updatePartnerPaymentAction(payment!.id, values)
          : createPartnerPaymentAction(values)
      }
      successMessage={editing ? "Vendor payment updated" : "Payment entry recorded successfully"}
      wide
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" error={errors.entryDate?.message} required>
          <Input type="date" {...register("entryDate")} />
        </Field>

        <Field label="Payment Type" error={errors.direction?.message} required>
          <NativeSelect {...register("direction")}>
            <option value="DEBIT">Payment (Money Out)</option>
            <option value="CREDIT">Receipt / Refund (Money In)</option>
          </NativeSelect>
        </Field>

        <Field label="Select Vendor" error={errors.partnerId?.message} required>
          <NativeSelect {...register("partnerId")}>
            <option value="">Choose vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Amount (₹)" error={errors.amount?.message} required>
          <Input
            inputMode="decimal"
            value={String(amount ?? 0)}
            onChange={(event) =>
              setValue("amount", toFiniteNumber(event.target.value), {
                shouldValidate: true,
              })
            }
            className="text-right tabular-nums font-bold"
          />
        </Field>

        <Field label="Payment Method" error={errors.paymentMethod?.message} required>
          <NativeSelect {...register("paymentMethod")}>
            {PAYMENT_METHODS.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field
          label="Reference / Note Number"
          error={errors.referenceNo?.message}
          hint="Cheque No / UTR / Transaction ID"
        >
          <Input {...register("referenceNo")} placeholder="e.g. UTR-992388" />
        </Field>

        {canSelectBranch && !editing && (
          <Field label="Branch" error={errors.branchId?.message} required>
            <NativeSelect {...register("branchId")}>
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        <Field
          label="Particulars / Paid For"
          error={errors.particular?.message}
          required
          className="sm:col-span-2"
        >
          <Input
            {...register("particular")}
            placeholder="e.g. Payment for invoice or vendor goods"
          />
        </Field>

        <Field label="Description / Notes" error={errors.note?.message} className="sm:col-span-2">
          <Textarea rows={2} {...register("note")} placeholder="Any additional details..." />
        </Field>
      </div>
    </EntityDialog>
  );
}

function NativeSelect(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm capitalize disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
    />
  );
}

function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
  readonly required?: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive font-medium">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
