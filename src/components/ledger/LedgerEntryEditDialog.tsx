"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityDialog } from "@/components/shared/EntityDialog";
import { toFiniteNumber } from "@/lib/quotation-engine/money";
import {
  PAYMENT_METHODS,
  ledgerEntryDetailsSchema,
  type LedgerEntryDetailsInput,
} from "@/modules/ledger/ledger-schema";
import { updateLedgerEntryDetailsAction } from "@/modules/ledger/ledger-actions";

/**
 * Edit dialog for any ledger voucher (receipt, payment, customer/vendor
 * payment). Only the correctable fields are inputs; the voucher number, party
 * and direction are shown read-only so it is clear what cannot change here.
 */
export function LedgerEntryEditDialog({
  entry,
}: {
  readonly entry: {
    readonly id: string;
    readonly reference: string;
    readonly partyName?: string | null;
    readonly direction: "CREDIT" | "DEBIT";
    readonly entryDate: string;
    readonly amount: number;
    readonly paymentMethod: string;
    readonly referenceNo: string | null;
    readonly particular: string;
    readonly note: string | null;
  };
}) {
  const form = useForm<LedgerEntryDetailsInput>({
    resolver: zodResolver(ledgerEntryDetailsSchema),
    defaultValues: {
      entryDate: entry.entryDate.slice(0, 10),
      amount: entry.amount,
      paymentMethod: entry.paymentMethod as LedgerEntryDetailsInput["paymentMethod"],
      referenceNo: entry.referenceNo ?? "",
      particular: entry.particular,
      note: entry.note ?? "",
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
          aria-label={`Edit ${entry.reference}`}
          title="Edit"
        >
          <Pencil className="size-4" />
        </Button>
      }
      title={`Edit ${entry.reference}`}
      description="Correct the details of this voucher. Voucher number, party and type cannot be changed."
      form={form}
      onSubmit={(values) => updateLedgerEntryDetailsAction(entry.id, values)}
      successMessage="Entry updated"
      wide
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReadOnly label="Voucher no" value={entry.reference} />
        <ReadOnly
          label={entry.direction === "CREDIT" ? "Received from" : "Paid to"}
          value={entry.partyName || "—"}
        />

        <Field label="Date" error={errors.entryDate?.message} required>
          <Input type="date" {...register("entryDate")} />
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
            className="text-right tabular-nums"
          />
        </Field>

        <Field label="Payment method" error={errors.paymentMethod?.message} required>
          <select
            {...register("paymentMethod")}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {PAYMENT_METHODS.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Reference / UTR / cheque no" error={errors.referenceNo?.message}>
          <Input {...register("referenceNo")} />
        </Field>

        <Field
          label="Particulars"
          error={errors.particular?.message}
          required
          className="sm:col-span-2"
        >
          <Input {...register("particular")} />
        </Field>

        <Field label="Note" error={errors.note?.message} className="sm:col-span-2">
          <Textarea rows={2} {...register("note")} />
        </Field>
      </div>
    </EntityDialog>
  );
}

function ReadOnly({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label} <span className="font-normal normal-case">(read-only)</span>
      </Label>
      <p className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm">{value}</p>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  className,
  children,
}: {
  readonly label: string;
  readonly error?: string;
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
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
