"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityDialog } from "@/components/shared/EntityDialog";
import { toFiniteNumber } from "@/lib/quotation-engine/money";
import {
  LEDGER_DIRECTIONS,
  LEDGER_STATUSES,
  PAYMENT_METHODS,
  ledgerEntrySchema,
  type LedgerEntryInput,
} from "@/modules/ledger/ledger-schema";
import { createLedgerEntryAction } from "@/modules/ledger/ledger-actions";

export function LedgerEntryDialog({
  customers,
  branches,
  canSelectBranch,
  canApprove,
  defaultBranchId,
}: {
  readonly customers: readonly { id: string; name: string }[];
  readonly branches: readonly { id: string; name: string }[];
  readonly canSelectBranch: boolean;
  readonly canApprove: boolean;
  readonly defaultBranchId: string | null;
}) {
  const form = useForm<LedgerEntryInput>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: {
      entryDate: new Date().toISOString().slice(0, 10),
      direction: "CREDIT",
      amount: 0,
      paymentMethod: "CASH",
      referenceNo: "",
      particular: "",
      note: "",
      // Managers cannot self-approve, so their entries always open as PENDING.
      status: canApprove ? "RECEIVED" : "PENDING",
      customerId: "",
      quotationId: "",
      branchId: defaultBranchId ?? "",
    },
  });

  const { register, formState, setValue, watch } = form;
  const errors = formState.errors;
  const amount = watch("amount");

  return (
    <EntityDialog
      trigger={
        <Button>
          <Plus />
          New entry
        </Button>
      }
      title="New ledger entry"
      description="Records a payment against the branch cash book."
      form={form}
      onSubmit={createLedgerEntryAction}
      successMessage="Ledger entry recorded"
      wide
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" error={errors.entryDate?.message} required>
          <Input type="date" {...register("entryDate")} />
        </Field>

        <Field label="Direction" error={errors.direction?.message} required>
          <NativeSelect {...register("direction")}>
            {LEDGER_DIRECTIONS.map((value) => (
              <option key={value} value={value}>
                {value === "CREDIT" ? "Credit — money in" : "Debit — money out"}
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
            className="text-right tabular-nums"
          />
        </Field>

        <Field label="Payment method" error={errors.paymentMethod?.message} required>
          <NativeSelect {...register("paymentMethod")}>
            {PAYMENT_METHODS.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field
          label="Note number"
          error={errors.referenceNo?.message}
          hint="Cheque / UTR / transaction id"
        >
          <Input {...register("referenceNo")} />
        </Field>

        <Field label="Status" error={errors.status?.message} required>
          <NativeSelect {...register("status")} disabled={!canApprove}>
            {LEDGER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </NativeSelect>
          {!canApprove && (
            <p className="text-xs text-muted-foreground">
              Entries you create start as pending until an administrator
              approves them.
            </p>
          )}
        </Field>

        <Field label="Customer" error={errors.customerId?.message}>
          <NativeSelect {...register("customerId")}>
            <option value="">Not linked</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        {canSelectBranch && (
          <Field label="Branch" error={errors.branchId?.message} required>
            <NativeSelect {...register("branchId")}>
              <option value="">Select a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        <Field
          label="Paid through"
          error={errors.particular?.message}
          required
          className="sm:col-span-2"
        >
          <Input
            {...register("particular")}
            placeholder="Part payment against QT/2026/0007"
          />
        </Field>

        <Field label="Note" error={errors.note?.message} className="sm:col-span-2">
          <Textarea rows={2} {...register("note")} />
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
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
