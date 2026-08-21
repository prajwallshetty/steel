"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityDialog } from "@/components/shared/EntityDialog";
import {
  staffSchema,
  type StaffInput,
} from "@/modules/staff/staff-schema";
import {
  createStaffAction,
  updateStaffAction,
} from "@/modules/staff/staff-actions";

export interface StaffFormValues extends StaffInput {
  readonly id?: string;
}

export function StaffDialog({
  staff,
  branches,
  canSelectBranch,
  defaultBranchId,
}: {
  readonly staff?: StaffFormValues;
  readonly branches: readonly { id: string; name: string }[];
  readonly canSelectBranch: boolean;
  readonly defaultBranchId: string | null;
}) {
  const editing = Boolean(staff?.id);

  const form = useForm<StaffInput>({
    resolver: zodResolver(staffSchema) as any,
    defaultValues: {
      name: staff?.name ?? "",
      phone: staff?.phone ?? "",
      email: staff?.email ?? "",
      designation: staff?.designation ?? "",
      address: staff?.address ?? "",
      balance: staff?.balance ?? 0,
      branchId: staff?.branchId ?? defaultBranchId ?? "",
    },
  });

  const { register, formState } = form;
  const errors = formState.errors;

  return (
    <EntityDialog
      trigger={
        editing ? (
          <Button variant="ghost" size="icon" aria-label="Edit staff member">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            New Staff Member
          </Button>
        )
      }
      title={editing ? "Edit Staff Member" : "New Staff Member"}
      description="Staff members belong to a branch. Their payments or advances affect Cash in Hand."
      form={form}
      onSubmit={(values) =>
        editing
          ? updateStaffAction(staff!.id!, values)
          : createStaffAction(values)
      }
      successMessage={editing ? "Staff member updated" : "Staff member created"}
      wide
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Staff Name" error={errors.name?.message} required className="sm:col-span-2">
          <Input {...register("name")} placeholder="AJEET GOLD" className="uppercase" />
        </Field>

        <Field label="Designation / Role" error={errors.designation?.message}>
          <Input {...register("designation")} placeholder="Manager, Worker, Staff AC" />
        </Field>

        <Field label="Balance / Advance (₹)" error={errors.balance?.message}>
          <Input {...register("balance")} type="number" step="any" placeholder="0" />
        </Field>

        <Field label="Phone" error={errors.phone?.message}>
          <Input {...register("phone")} placeholder="+91 98765 43210" />
        </Field>

        <Field label="Email" error={errors.email?.message}>
          <Input {...register("email")} type="email" placeholder="staff@example.com" />
        </Field>

        <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
          <Input {...register("address")} placeholder="Full address" />
        </Field>

        {canSelectBranch && (
          <Field label="Division / Branch" error={errors.branchId?.message} required className="sm:col-span-2">
            <select
              {...register("branchId")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select Division...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
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
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
