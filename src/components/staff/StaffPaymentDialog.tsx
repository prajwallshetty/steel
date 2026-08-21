"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityDialog } from "@/components/shared/EntityDialog";
import {
  staffPaymentSchema,
  type StaffPaymentInput,
} from "@/modules/staff/staff-schema";
import { recordStaffTransactionAction } from "@/modules/staff/staff-actions";

export function StaffPaymentDialog({
  staffList,
  defaultStaffId,
}: {
  readonly staffList: readonly { id: string; name: string }[];
  readonly defaultStaffId?: string;
}) {
  const form = useForm<StaffPaymentInput>({
    resolver: zodResolver(staffPaymentSchema) as any,
    defaultValues: {
      type: "CASH_OUT",
      staffId: defaultStaffId ?? (staffList.length > 0 ? staffList[0].id : ""),
      amount: 0,
      paymentMethod: "CASH",
      entryDate: new Date().toISOString().slice(0, 10),
      particular: "Staff Payment",
      referenceNo: "",
      note: "",
    },
  });

  const { register, formState, watch, setValue } = form;
  const errors = formState.errors;
  const type = watch("type");

  return (
    <EntityDialog
      trigger={
        <Button>
          <Plus className="size-4" />
          New Payment
        </Button>
      }
      title="New Staff Payment"
      description="Record cash paid out to staff or cash received in from staff."
      form={form}
      onSubmit={(values) => recordStaffTransactionAction(values)}
      successMessage="Staff payment recorded successfully"
      wide
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Transaction Type: Cash Out / Cash In */}
        <div className="sm:col-span-2">
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Transaction Type <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setValue("type", "CASH_OUT");
                if (!watch("particular") || watch("particular") === "Cash Received") {
                  setValue("particular", "Staff Payment");
                }
              }}
              className={`flex items-center justify-center gap-2 rounded-lg border p-3 font-medium text-sm transition-all ${
                type === "CASH_OUT"
                  ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-semibold shadow-sm"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <ArrowUpRight className="size-4 text-red-600" />
              Cash Out (Payment to Staff)
            </button>

            <button
              type="button"
              onClick={() => {
                setValue("type", "CASH_IN");
                if (!watch("particular") || watch("particular") === "Staff Payment") {
                  setValue("particular", "Cash Received");
                }
              }}
              className={`flex items-center justify-center gap-2 rounded-lg border p-3 font-medium text-sm transition-all ${
                type === "CASH_IN"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold shadow-sm"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <ArrowDownLeft className="size-4 text-emerald-600" />
              Cash In (Receipt from Staff)
            </button>
          </div>
        </div>

        {/* Staff Picker */}
        <Field label="Select Staff Member" error={errors.staffId?.message} required className="sm:col-span-2">
          <select
            {...register("staffId")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select Staff...</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        {/* Amount */}
        <Field label="Amount (₹)" error={errors.amount?.message} required>
          <Input {...register("amount")} type="number" step="any" placeholder="0.00" />
        </Field>

        {/* Entry Date */}
        <Field label="Date" error={errors.entryDate?.message} required>
          <Input {...register("entryDate")} type="date" />
        </Field>

        {/* Payment Method */}
        <Field label="Payment Method" error={errors.paymentMethod?.message} required>
          <select
            {...register("paymentMethod")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="CASH">CASH (Affects Cash in Hand)</option>
            <option value="BANK_TRANSFER">BANK TRANSFER</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">CHEQUE</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="IMPS">IMPS</option>
            <option value="CARD">CARD</option>
          </select>
        </Field>

        {/* Reference / Instrument No */}
        <Field label="Reference / Cheque / UTR No" error={errors.referenceNo?.message}>
          <Input {...register("referenceNo")} placeholder="Optional ref number" />
        </Field>

        {/* Particulars */}
        <Field label="Particulars / Description" error={errors.particular?.message} required className="sm:col-span-2">
          <Input {...register("particular")} placeholder="e.g. Advance Payment, Salary, Reimbursement" />
        </Field>

        {/* Note */}
        <Field label="Notes / Remarks" error={errors.note?.message} className="sm:col-span-2">
          <Textarea {...register("note")} placeholder="Optional additional remarks..." rows={2} />
        </Field>
      </div>
    </EntityDialog>
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
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
