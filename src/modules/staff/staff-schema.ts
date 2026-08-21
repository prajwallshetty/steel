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

export const staffPaymentSchema = z.object({
  type: z.enum(["CASH_OUT", "CASH_IN"]),
  staffId: z.string().trim().min(1, "Please select a staff member"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paymentMethod: z
    .enum(["CASH", "CHEQUE", "NEFT", "RTGS", "UPI", "IMPS", "BANK_TRANSFER", "CARD"])
    .default("CASH"),
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  particular: z.string().trim().min(2, "Description is required").max(200),
  referenceNo: z.string().trim().max(80).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  branchId: z.string().trim().optional().or(z.literal("")),
});

export type StaffPaymentInput = z.infer<typeof staffPaymentSchema>;

