import { z } from "zod";

export const staffSchema = z.object({
  name: z.string().trim().min(2, "Staff name is required").max(160),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  designation: z.string().trim().max(100).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  balance: z.coerce.number().default(0),
  /** Ignored for non-super users — the branch comes from their session. */
  branchId: z.string().trim().optional().or(z.literal("")),
});

export type StaffInput = z.infer<typeof staffSchema>;
