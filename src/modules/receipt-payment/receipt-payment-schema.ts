import { z } from "zod";
import { PAYMENT_METHODS, LEDGER_STATUSES } from "@/modules/ledger/ledger-schema";

export const PARTY_TYPES = ["CUSTOMER", "VENDOR", "EMPLOYEE", "EXPENSE", "OTHERS"] as const;

const REFERENCE_REQUIRED: readonly string[] = [
  "CHEQUE",
  "NEFT",
  "RTGS",
  "UPI",
  "IMPS",
  "BANK_TRANSFER",
];

export const paymentInputSchema = z
  .object({
    entryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required")
      .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), {
        message: "Date is not a valid date",
      }),
    partyType: z.enum(PARTY_TYPES),
    partyName: z.string().trim().min(1, "Name is required"),
    customerId: z.string().trim().optional().or(z.literal("")),
    vendorBillId: z.string().trim().optional().or(z.literal("")),
    amount: z
      .number({ invalid_type_error: "Amount must be a number" })
      .finite()
      .positive("Amount must be greater than zero")
      .max(1_000_000_000, "Amount is too large"),
    paymentMethod: z.enum(PAYMENT_METHODS),
    referenceNo: z.string().trim().max(80).optional().or(z.literal("")),
    particular: z.string().trim().min(2, "Description is required").max(200),
    note: z.string().trim().max(500).optional().or(z.literal("")),
    branchId: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (REFERENCE_REQUIRED.includes(value.paymentMethod) && !value.referenceNo?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceNo"],
        message: `Reference/Note number is required for ${value.paymentMethod.replace(/_/g, " ").toLowerCase()}`,
      });
    }
  });

export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const receiptInputSchema = z
  .object({
    entryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required")
      .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), {
        message: "Date is not a valid date",
      }),
    partyType: z.enum(PARTY_TYPES),
    partyName: z.string().trim().min(1, "Name is required"),
    customerId: z.string().trim().optional().or(z.literal("")),
    quotationId: z.string().trim().optional().or(z.literal("")), // Linked outstanding invoice
    amount: z
      .number({ invalid_type_error: "Amount must be a number" })
      .finite()
      .positive("Amount must be greater than zero")
      .max(1_000_000_000, "Amount is too large"),
    paymentMethod: z.enum(PAYMENT_METHODS),
    referenceNo: z.string().trim().max(80).optional().or(z.literal("")),
    particular: z.string().trim().min(2, "Description is required").max(200),
    note: z.string().trim().max(500).optional().or(z.literal("")),
    branchId: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (REFERENCE_REQUIRED.includes(value.paymentMethod) && !value.referenceNo?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceNo"],
        message: `Reference/Note number is required for ${value.paymentMethod.replace(/_/g, " ").toLowerCase()}`,
      });
    }
  });

export type ReceiptInput = z.infer<typeof receiptInputSchema>;

export const vendorBillSchema = z.object({
  billNumber: z.string().trim().min(1, "Bill number is required"),
  vendorName: z.string().trim().min(1, "Vendor name is required"),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .finite()
    .positive("Amount must be greater than zero"),
  billDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  branchId: z.string().trim().optional().or(z.literal("")),
});

export type VendorBillInput = z.infer<typeof vendorBillSchema>;

export const partnerPaymentSchema = z
  .object({
    entryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required")
      .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), {
        message: "Date is not a valid date",
      }),
    direction: z.enum(["CREDIT", "DEBIT"]),
    partnerType: z.enum(["CUSTOMER", "VENDOR"]),
    partnerId: z.string().trim().min(1, "Selection is required"),
    amount: z
      .number({ invalid_type_error: "Amount must be a number" })
      .finite()
      .positive("Amount must be greater than zero")
      .max(1_000_000_000, "Amount is too large"),
    paymentMethod: z.enum(PAYMENT_METHODS),
    referenceNo: z.string().trim().max(80).optional().or(z.literal("")),
    particular: z.string().trim().min(2, "Description is required").max(200),
    note: z.string().trim().max(500).optional().or(z.literal("")),
    branchId: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (REFERENCE_REQUIRED.includes(value.paymentMethod) && !value.referenceNo?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceNo"],
        message: `Reference/Note number is required for ${value.paymentMethod.replace(/_/g, " ").toLowerCase()}`,
      });
    }
  });

export type PartnerPaymentInput = z.infer<typeof partnerPaymentSchema>;
