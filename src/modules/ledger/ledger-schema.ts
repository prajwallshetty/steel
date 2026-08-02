import { z } from "zod";

export const PAYMENT_METHODS = [
  "CASH",
  "CHEQUE",
  "NEFT",
  "RTGS",
  "UPI",
  "IMPS",
  "BANK_TRANSFER",
  "CARD",
] as const;

export const LEDGER_STATUSES = [
  "PENDING",
  "RECEIVED",
  "CLEARED",
  "CANCELLED",
  "RETURNED",
] as const;

export const LEDGER_DIRECTIONS = ["CREDIT", "DEBIT"] as const;

/** Methods that are meaningless without an instrument/transaction number. */
const REFERENCE_REQUIRED: readonly string[] = [
  "CHEQUE",
  "NEFT",
  "RTGS",
  "UPI",
  "IMPS",
  "BANK_TRANSFER",
];

export const ledgerEntrySchema = z
  .object({
    entryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required")
      .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), {
        message: "Date is not a real calendar date",
      }),
    direction: z.enum(LEDGER_DIRECTIONS),
    amount: z
      .number({ invalid_type_error: "Amount must be a number" })
      .finite("Amount must be a valid number")
      .positive("Amount must be greater than zero")
      .max(1_000_000_000, "Amount looks too large — check the figure"),
    paymentMethod: z.enum(PAYMENT_METHODS),
    referenceNo: z.string().trim().max(80).optional().or(z.literal("")),
    particular: z.string().trim().min(2, "Describe what this entry is for").max(200),
    note: z.string().trim().max(500).optional().or(z.literal("")),
    status: z.enum(LEDGER_STATUSES),
    customerId: z.string().trim().optional().or(z.literal("")),
    quotationId: z.string().trim().optional().or(z.literal("")),
    branchId: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    // A bank transfer with no UTR cannot be reconciled against a statement,
    // which is the entire purpose of recording it.
    if (
      REFERENCE_REQUIRED.includes(value.paymentMethod) &&
      !value.referenceNo?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceNo"],
        message: `A Note number is required for ${value.paymentMethod.replace(/_/g, " ").toLowerCase()} payments`,
      });
    }
  });

export type LedgerEntryInput = z.infer<typeof ledgerEntrySchema>;

export const ledgerFilterSchema = z.object({
  search: z.string().trim().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(LEDGER_STATUSES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  branchId: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  createdById: z.string().trim().optional(),
});

export type LedgerFilterInput = z.infer<typeof ledgerFilterSchema>;
