import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Customer name is required").max(160),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  gstNumber: z
    .string()
    .trim()
    .regex(
      /^27[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Enter a valid 15-character Maharashtra GSTIN (starts with 27)",
    )
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  pin: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "PIN must be 6 digits")
    .optional()
    .or(z.literal("")),
  garudaBalance: z.coerce.number().optional().default(0),
  currentDues: z.coerce.number().optional().default(0),
  /** Ignored for non-super users — the branch comes from their session. */
  branchId: z.string().trim().optional().or(z.literal("")),
});

export type CustomerInput = z.infer<typeof customerSchema>;
