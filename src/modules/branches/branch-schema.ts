import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const branchSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(8, "Code must be 8 characters or fewer")
    .regex(/^[A-Za-z0-9]+$/, "Code may contain letters and digits only"),
  name: z.string().trim().min(2, "Branch name is required").max(120),
  state: z.string().trim().min(2, "State is required").max(80),
  // GSTIN: 2-digit state code, 10-char PAN, entity digit, 'Z', checksum.
  gstNumber: z
    .string()
    .trim()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Enter a valid 15-character GSTIN",
    )
    .optional()
    .or(z.literal("")),
  address: optionalText(300),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  logoUrl: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
});

export type BranchInput = z.infer<typeof branchSchema>;
