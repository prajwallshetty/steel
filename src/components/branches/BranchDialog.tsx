"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityDialog } from "@/components/shared/EntityDialog";
import { branchSchema, type BranchInput } from "@/modules/branches/branch-schema";
import {
  createBranchAction,
  updateBranchAction,
} from "@/modules/branches/branch-actions";

export function BranchDialog({
  branch,
  canEditCode,
}: {
  readonly branch?: BranchInput & { readonly id: string };
  readonly canEditCode: boolean;
}) {
  const editing = Boolean(branch?.id);

  const form = useForm<BranchInput>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      code: branch?.code ?? "",
      name: branch?.name ?? "",
      state: branch?.state ?? "",
      gstNumber: branch?.gstNumber ?? "",
      address: branch?.address ?? "",
      phone: branch?.phone ?? "",
      email: branch?.email ?? "",
      logoUrl: branch?.logoUrl ?? "",
      startingBalance: branch?.startingBalance ?? 0,
      status: branch?.status ?? "ACTIVE",
    },
  });

  const { register, formState } = form;
  const errors = formState.errors;

  return (
    <EntityDialog
      trigger={
        editing ? (
          <Button variant="ghost" size="icon" aria-label="Edit division">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            New division
          </Button>
        )
      }
      title={editing ? "Edit division" : "New division"}
      description="Divisions maintain separate financial records, cash in hand, and daily opening/closing balances."
      form={form}
      onSubmit={(values) =>
        editing ? updateBranchAction(branch!.id, values) : createBranchAction(values)
      }
      successMessage={editing ? "Division updated" : "Division created"}
      wide
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Code"
          error={errors.code?.message}
          required
          hint="Appears in every reference, e.g. MNG/QT/2026/0001"
        >
          <Input
            {...register("code")}
            placeholder="MNG"
            className="uppercase"
            disabled={editing && !canEditCode}
          />
        </Field>

        <Field label="Name" error={errors.name?.message} required>
          <Input {...register("name")} placeholder="Mangalore Division" />
        </Field>

        <Field label="State" error={errors.state?.message} required>
          <Input {...register("state")} placeholder="Karnataka" />
        </Field>

        <Field label="Starting Balance (₹)" error={errors.startingBalance?.message} required hint="Initial baseline balance for this division">
          <Input
            {...register("startingBalance")}
            type="number"
            step="0.01"
            placeholder="50000"
          />
        </Field>

        <Field label="GSTIN" error={errors.gstNumber?.message}>
          <Input {...register("gstNumber")} placeholder="29ABCDE1234F1Z5" className="uppercase" />
        </Field>

        <Field label="Phone" error={errors.phone?.message}>
          <Input {...register("phone")} />
        </Field>

        <Field label="Email" error={errors.email?.message}>
          <Input {...register("email")} type="email" />
        </Field>

        <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
          <Input {...register("address")} />
        </Field>

        <Field label="Logo URL" error={errors.logoUrl?.message} className="sm:col-span-2">
          <Input {...register("logoUrl")} placeholder="https://…" />
        </Field>

        <Field label="Status" error={errors.status?.message} required>
          <select
            {...register("status")}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm capitalize"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Field>
      </div>
    </EntityDialog>
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
