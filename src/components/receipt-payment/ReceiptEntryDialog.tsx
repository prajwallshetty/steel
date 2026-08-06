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
  receiptInputSchema,
  type ReceiptInput,
} from "@/modules/receipt-payment/receipt-payment-schema";
import { createReceiptAction } from "@/modules/receipt-payment/receipt-payment-actions";

export function ReceiptEntryDialog({
  customers,
  branches,
  canSelectBranch,
  canApprove,
  defaultBranchId,
  distinctOtherReceipts,
  outstandingInvoices,
}: {
  readonly customers: readonly { id: string; name: string }[];
  readonly branches: readonly { id: string; name: string }[];
  readonly canSelectBranch: boolean;
  readonly canApprove: boolean;
  readonly defaultBranchId: string | null;
  readonly distinctOtherReceipts: readonly string[];
  readonly outstandingInvoices: readonly any[];
}) {
  const form = useForm<ReceiptInput>({
    resolver: zodResolver(receiptInputSchema),
    defaultValues: {
      entryDate: new Date().toISOString().slice(0, 10),
      partyType: "CUSTOMER",
      partyName: "",
      customerId: "",
      quotationId: "",
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
  const quotationId = watch("quotationId");
  const amount = watch("amount");

  // Outstanding invoices for the selected customer
  const [matchingInvoices, setMatchingInvoices] = useState<any[]>([]);

  // Update party name when customer selection changes
  useEffect(() => {
    if (partyType === "CUSTOMER" && customerId) {
      const selected = customers.find((c) => c.id === customerId);
      if (selected) {
        setValue("partyName", selected.name, { shouldValidate: true });
        // Filter invoices for this customer
        const filtered = outstandingInvoices.filter(
          (inv) => inv.customerId === customerId || inv.customerId === undefined // fallback in case of strict id matches
        );
        // Sometimes outstandingInvoices array holds elements with specific customer relation
        const cInvoices = outstandingInvoices.filter(inv => inv.customerId === customerId);
        setMatchingInvoices(cInvoices);
      }
    } else {
      setMatchingInvoices([]);
      setValue("quotationId", "");
    }
  }, [customerId, partyType, customers, outstandingInvoices, setValue]);

  // Handle invoice selection
  const handleInvoiceChange = (qId: string) => {
    setValue("quotationId", qId);
    if (qId) {
      const inv = matchingInvoices.find((i) => i.id === qId);
      if (inv) {
        setValue("amount", inv.dueAmount, { shouldValidate: true });
        setValue(
          "particular",
          `Receipt against Invoice/Quotation ${inv.reference} (Amt: ₹${formatMoney(inv.amount)})`,
          { shouldValidate: true }
        );
      }
    } else {
      setValue("quotationId", "");
      setValue("particular", "");
    }
  };

  const getPersonSuggestions = () => {
    if (partyType === "EXPENSE") return ["REFUND RECEIVED"];
    if (partyType === "OTHERS") return ["CASH DEPOSIT", "OTHER INCOME", "INTEREST RECEIVED"];
    return distinctOtherReceipts;
  };

  return (
    <EntityDialog
      trigger={
        <Button>
          <Plus className="size-4" />
          Record Receipt
        </Button>
      }
      title="New Cash In Voucher"
      description="Records incoming money into the branch cash/bank account."
      form={form}
      onSubmit={createReceiptAction}
      successMessage="Receipt recorded successfully"
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

        {matchingInvoices.length > 0 && (
          <Field label="Link Outstanding Invoice" error={errors.quotationId?.message}>
            <NativeSelect
              value={quotationId}
              onChange={(e) => handleInvoiceChange(e.target.value)}
            >
              <option value="">No invoice link (Direct Payment)</option>
              {matchingInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.reference} (Due: ₹{formatMoney(inv.dueAmount)})
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}



        <Field label="Amount (+) (₹)" error={errors.amount?.message} required>
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
          label="Particulars / Received For"
          error={errors.particular?.message}
          required
          className="sm:col-span-2"
        >
          <Input
            {...register("particular")}
            placeholder="e.g. Receipt against invoice QT/2026/0001"
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
