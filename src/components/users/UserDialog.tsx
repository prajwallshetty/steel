"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityDialog } from "@/components/shared/EntityDialog";
import { ROLE_LABELS } from "@/modules/permissions/permissions";
import {
  createUserSchema,
  updateUserFormSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/modules/users/user-schema";
import {
  createUserAction,
  updateUserAction,
} from "@/modules/users/user-actions";

export interface UserFormValues extends UpdateUserInput {
  readonly id: string;
}

export function UserDialog({
  user,
  branches,
  assignableRoles,
  canSelectBranch,
  defaultBranchId,
}: {
  readonly user?: UserFormValues;
  readonly branches: readonly { id: string; name: string }[];
  readonly assignableRoles: readonly Role[];
  readonly canSelectBranch: boolean;
  readonly defaultBranchId: string | null;
}) {
  const editing = Boolean(user?.id);

  const form = useForm<CreateUserInput>({
    // Password is only collected on create; editing uses the reset flow so a
    // routine detail change never forces a new credential.
    resolver: zodResolver(editing ? updateUserFormSchema : createUserSchema),
    defaultValues: {
      name: user?.name ?? "",
      username: user?.username ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      role: user?.role ?? assignableRoles[0] ?? Role.MANAGER,
      branchId: user?.branchId ?? defaultBranchId ?? "",
      status: user?.status ?? "ACTIVE",
      password: "",
    },
  });

  const { register, formState, watch } = form;
  const errors = formState.errors;
  const role = watch("role");

  return (
    <EntityDialog
      trigger={
        editing ? (
          <Button variant="ghost" size="icon" aria-label="Edit user">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            New user
          </Button>
        )
      }
      title={editing ? "Edit user" : "New user"}
      description="Users belong to exactly one branch and see only what their role allows."
      form={form}
      onSubmit={(values) =>
        editing ? updateUserAction(user!.id, values) : createUserAction(values)
      }
      successMessage={editing ? "User updated" : "User created"}
      wide
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.name?.message} required>
          <Input {...register("name")} placeholder="Ramesh Kulkarni" />
        </Field>

        <Field label="Username" error={errors.username?.message} required>
          <Input {...register("username")} placeholder="ramesh.k" className="lowercase" />
        </Field>

        <Field label="Email" error={errors.email?.message}>
          <Input {...register("email")} type="email" />
        </Field>

        <Field label="Phone" error={errors.phone?.message}>
          <Input {...register("phone")} />
        </Field>

        <Field label="Role" error={errors.role?.message} required>
          <select
            {...register("role")}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {assignableRoles.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" error={errors.status?.message} required>
          <select
            {...register("status")}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </Field>

        {role !== Role.SUPER_ADMIN && (
          <Field
            label="Branch"
            error={errors.branchId?.message}
            required
            className={canSelectBranch ? "" : "opacity-70"}
          >
            <select
              {...register("branchId")}
              disabled={!canSelectBranch}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:cursor-not-allowed disabled:bg-muted"
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

        {!editing && (
          <Field
            label="Password"
            error={errors.password?.message}
            required
            hint="At least 8 characters with upper, lower and a digit."
            className="sm:col-span-2"
          >
            <Input {...register("password")} type="password" autoComplete="new-password" />
          </Field>
        )}
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
