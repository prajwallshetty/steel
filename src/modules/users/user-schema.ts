import { z } from "zod";

export const ROLES = ["SUPER_ADMIN", "BRANCH_ADMIN", "MANAGER", "ACCOUNTANT", "SALES"] as const;

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const baseUser = {
  name: z.string().trim().min(2, "Name is required").max(120),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(40)
    .regex(
      /^[a-z0-9._-]+$/,
      "Username may contain lowercase letters, digits, dot, underscore and hyphen",
    ),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  role: z.enum(ROLES),
  /** Required for every role except SUPER_ADMIN; enforced by the refinement. */
  branchId: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "DISABLED"]),
};

/**
 * A branch is mandatory for scoped roles and meaningless for SUPER_ADMIN.
 *
 * This is not cosmetic: `resolveScope` returns "no access" for a branch-less
 * non-super account, so letting one through would create a user who can sign in
 * but see nothing, with no obvious cause.
 *
 * Written as a plain callback and attached to each schema directly. Routing it
 * through a generic wrapper widened the inferred output to `any`, which in turn
 * degraded every `FieldErrors` type in the forms built on it.
 */
const requireBranchForScopedRoles = (
  value: { role: string; branchId?: string },
  ctx: z.RefinementCtx,
): void => {
  if (value.role === "SUPER_ADMIN") return;
  if (!value.branchId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["branchId"],
      message: "Select a branch for this role",
    });
  }
};

export const createUserSchema = z
  .object({ ...baseUser, password: passwordField })
  .superRefine(requireBranchForScopedRoles);

export const updateUserSchema = z
  .object(baseUser)
  .superRefine(requireBranchForScopedRoles);

/**
 * The edit-mode form schema.
 *
 * Carries a `password` field that is always present but never validated, so it
 * produces the *same* output type as `createUserSchema`. One form component can
 * then swap resolvers between create and edit without a cast — and the empty
 * string is stripped by `updateUserSchema` on the server, which has no password
 * field at all. Changing a password goes through the explicit reset flow.
 */
export const updateUserFormSchema = z
  // A plain `z.string()`, not `.optional()`: an optional field widens the
  // schema's *input* type, which no longer matches the create resolver.
  .object({ ...baseUser, password: z.string() })
  .superRefine(requireBranchForScopedRoles);

export const resetPasswordSchema = z.object({
  password: passwordField,
});

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
