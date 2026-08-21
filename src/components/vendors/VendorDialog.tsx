"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityDialog } from "@/components/shared/EntityDialog";
import {
  vendorSchema,
  type VendorInput,
} from "@/modules/vendors/vendor-schema";
import {
  createVendorAction,
  updateVendorAction,
} from "@/modules/vendors/vendor-actions";

export interface VendorFormValues extends VendorInput {
  readonly id?: string;
}

export function VendorDialog({
  vendor,
  branches,
  canSelectBranch,
  defaultBranchId,
}: {
  readonly vendor?: VendorFormValues;
  readonly branches: readonly { id: string; name: string }[];
  readonly canSelectBranch: boolean;
  readonly defaultBranchId: string | null;
}) {
  const editing = Boolean(vendor?.id);

  const form = useForm<VendorInput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: vendor?.name ?? "",
      phone: vendor?.phone ?? "",
      email: vendor?.email ?? "",
      gstNumber: vendor?.gstNumber ?? "",
      address: vendor?.address ?? "",
      city: vendor?.city ?? "",
      state: vendor?.state || "Maharashtra",
      pin: vendor?.pin ?? "",
      balance: vendor?.balance ?? 0,
      branchId: vendor?.branchId ?? defaultBranchId ?? "",
    },
  });

  const { register, formState } = form;
  const errors = formState.errors;

  return (
    <EntityDialog
      trigger={
        editing ? (
          <Button variant="ghost" size="icon" aria-label="Edit vendor">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            New vendor
          </Button>
        )
      }
      title={editing ? "Edit vendor" : "New vendor"}
      description="Vendors belong to a branch and are used in vendor payments and transactions."
      form={form}
      onSubmit={(values) =>
        editing
          ? updateVendorAction(vendor!.id!, values)
          : createVendorAction(values)
      }
      successMessage={editing ? "Vendor updated" : "Vendor created"}
      wide
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Vendor Name" error={errors.name?.message} required className="sm:col-span-2">
          <Input {...register("name")} placeholder="APEX VENDORS" className="uppercase" />
        </Field>

        <Field label="Amount / Balance (₹)" error={errors.balance?.message} className="sm:col-span-2">
          <Input {...register("balance")} type="number" step="any" placeholder="0" />
        </Field>

        <Field label="Phone" error={errors.phone?.message}>
          <Input {...register("phone")} placeholder="+91 98765 43210" />
        </Field>

        <Field label="Email" error={errors.email?.message}>
          <Input {...register("email")} type="email" placeholder="billing@example.com" />
        </Field>

        <Field label="GSTIN" error={errors.gstNumber?.message} className="sm:col-span-2">
          <Input {...register("gstNumber")} placeholder="27ABCDE1234F1Z5" className="uppercase" />
        </Field>

        <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
          <Input {...register("address")} />
        </Field>

        <Field label="City" error={errors.city?.message}>
          <Input {...register("city")} />
        </Field>

        <Field label="State" error={errors.state?.message}>
          <Input {...register("state")} readOnly className="bg-muted" />
        </Field>

        <Field label="PIN" error={errors.pin?.message}>
          <Input {...register("pin")} placeholder="411001" inputMode="numeric" />
        </Field>

        {canSelectBranch && !editing && (
          <Field label="Branch" error={errors.branchId?.message} required>
            <select
              {...register("branchId")}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Select a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        )}
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
