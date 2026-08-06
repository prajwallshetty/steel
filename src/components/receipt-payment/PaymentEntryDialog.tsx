"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ComboInput } from "@/components/ui/combo-input";
import { EntityDialog } from "@/components/shared/EntityDialog";
import { toFiniteNumber } from "@/lib/quotation-engine/money";
import { formatMoney } from "@/lib/format/number";
import { useEffect, useState } from "react";
import {
  LEDGER_STATUSES,
  PAYMENT_METHODS,
} from "@/modules/ledger/ledger-schema";
import {
  paymentInputSchema,
  type PaymentInput,
} from "@/modules/receipt-payment/receipt-payment-schema";
import { createPaymentAction } from "@/modules/receipt-payment/receipt-payment-actions";

export function PaymentEntryDialog({
  customers,
  branches,
  canSelectBranch,
  canApprove,
  defaultBranchId,
  distinctVendors,
  distinctEmployees,
  vendorBills,
}: {
  readonly customers: readonly { id: string; name: string }[];
  readonly branches: readonly { id: string; name: string }[];
  readonly canSelectBranch: boolean;
  readonly canApprove: boolean;
  readonly defaultBranchId: string | null;
  readonly distinctVendors: readonly string[];
  readonly distinctEmployees: readonly string[];
  readonly vendorBills: readonly any[];
}) {
  const form = useForm<PaymentInput>({
    resolver: zodResolver(paymentInputSchema),
    defaultValues: {
      entryDate: new Date().toISOString().slice(0, 10),
      partyType: "CUSTOMER",
      partyName: "",
      customerId: "",
      vendorBillId: "",
      amount: 0,
      paymentMethod: "CASH",
      referenceNo: "",
      particular: "",
      note: "",
      branchId: defaultBranchId ?? "",
    },
  });

  const { register, formState, setValue, watch, reset } = form;
  const errors = formState.errors;

  const partyType = watch("partyType");
  const partyName = watch("partyName");
  const customerId = watch("customerId");
  const vendorBillId = watch("vendorBillId");
  const amount = watch("amount");

  // Filter bills in memory for selected vendor
  const [matchingBills, setMatchingBills] = useState<any[]>([]);

  // Update party name when customerId changes
  useEffect(() => {
    if (partyType === "CUSTOMER" && customerId) {
      const selected = customers.find((c) => c.id === customerId);
      if (selected) {
        setValue("partyName", selected.name, { shouldValidate: true });
      }
    }
  }, [customerId, partyType, customers, setValue]);

  // Update matching bills when vendor name changes
  useEffect(() => {
    if (partyType === "VENDOR" && partyName) {
      const filtered = vendorBills.filter(
        (bill) =>
          bill.vendorName.toLowerCase() === partyName.toLowerCase() &&
          bill.dueAmount > 0
      );
      setMatchingBills(filtered);
    } else {
      setMatchingBills([]);
    }
  }, [partyName, partyType, vendorBills]);

  // Handle bill selection
  const handleBillChange = (billId: string) => {
    setValue("vendorBillId", billId);
    if (billId) {
      const bill = matchingBills.find((b) => b.id === billId);
      if (bill) {
        setValue("amount", bill.dueAmount, { shouldValidate: true });
        setValue(
          "particular",
          `Payment for Bill No ${bill.billNumber} (Amt: ₹${formatMoney(bill.amount)})`,
          { shouldValidate: true }
        );
      }
    } else {
      setValue("vendorBillId", "");
      setValue("particular", "");
    }
  };

  const getPersonSuggestions = () => {
    if (partyType === "VENDOR") return distinctVendors;
    if (partyType === "EMPLOYEE") return distinctEmployees;
    if (partyType === "EXPENSE") return ["RENT", "SALARIES", "OFFICE EXPENSES", "TRAVEL", "MISCELLANEOUS"];
    return [];
  };

  return (
    <EntityDialog
      trigger={
        <Button>
          <Plus className="size-4" />
          Record Payment
        </Button>
      }
      title="New Cash Out Voucher"
      description="Records an outgoing payment from the branch bank/cash account."
      form={form}
      onSubmit={createPaymentAction}
      successMessage="Payment recorded successfully"
      wide
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" error={errors.entryDate?.message} required>
          <Input type="date" {...register("entryDate")} />
        </Field>

        <Field label="Select Customer" error={errors.customerId?.message} required>
          <NativeSelect {...register("customerId")}>
            <option value="">Choose customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>



        <Field label="Amount (-) (₹)" error={errors.amount?.message} required>
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
          <Input {...register("referenceNo")} placeholder="e.g. CHQ-882312 or UTR-998823" />
        </Field>



        {canSelectBranch && (
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
            placeholder="e.g. Salary payment for July 2026 / Office Rent"
          />
        </Field>

        <Field label="Description / Internal Notes" error={errors.note?.message} className="sm:col-span-2">
          <Textarea rows={2} {...register("note")} placeholder="Any additional notes..." />
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
