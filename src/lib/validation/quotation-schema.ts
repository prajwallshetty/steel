import { z } from "zod";

/**
 * Validation for quotation input. These schemas are the contract for both the
 * client form (via `@hookform/resolvers`) and the route handlers, so a request
 * that bypasses the UI is held to exactly the same rules.
 */

/**
 * A money/quantity field: finite and non-negative.
 *
 * `.finite()` rather than `.refine(Number.isFinite)` — a refinement would
 * return a `ZodEffects` and close the door on the numeric `.min()`/`.max()`
 * builders that follow.
 */
const nonNegativeNumber = (label: string) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .finite(`${label} must be a valid number`)
    .min(0, { message: `${label} cannot be negative` });

const percentField = (label: string) =>
  nonNegativeNumber(label).max(100, { message: `${label} cannot exceed 100%` });

export const quotationRowSchema = z.object({
  id: z.string().min(1),
  size: z.string().min(1, "Size is required"),
  quantity: nonNegativeNumber("Quantity"),
  basic: nonNegativeNumber("Basic rate"),
  difference: nonNegativeNumber("Difference"),
  loading: nonNegativeNumber("Loading"),
  discountPercent: percentField("Discount"),
  gstPercent: percentField("GST"),
  highlight: z.boolean().nullable(),
});

export const quotationHeaderSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required")
    .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), {
      message: "Date is not a real calendar date",
    }),
  location: z.string().trim().min(1, "Location is required"),
  partyName: z.string().trim().min(1, "Party name is required"),
  brand: z.string().trim().min(1, "Brand is required"),
  basicRateLabel: z.string().trim().min(1, "Basic rate is required"),
  cdPercent: z.number({ invalid_type_error: "CD% must be a number" }).min(0, "CD% cannot be negative").max(100, "CD% cannot exceed 100%").optional().nullable(),
  cdType: z.enum(["basic", "basic-diff", "gross"]),
  diaDiffLabel: z.string(),
  payment: z.string().trim().min(1, "Payment term is required"),
  vehicleNo: z.string(),
});

export const QUOTATION_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const quotationDraftSchema = z.object({
  status: z.enum(QUOTATION_STATUSES),
  header: quotationHeaderSchema,
  rows: z
    .array(quotationRowSchema)
    .min(1, "At least one size row is required")
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        if (seen.has(row.size)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "size"],
            message: `Duplicate size "${row.size}"`,
          });
        }
        seen.add(row.size);
      });
    }),
  remarks: z.string(),
});

/**
 * Finalising demands at least one priced line — a zero-value quotation is
 * almost always an unfinished draft rather than a real offer.
 */
export const finalizedQuotationSchema = quotationDraftSchema.refine(
  (draft) => draft.rows.some((row) => row.quantity > 0),
  {
    path: ["rows"],
    message: "Enter a quantity on at least one size before finalizing",
  },
);

export type QuotationDraftInput = z.infer<typeof quotationDraftSchema>;
export type QuotationRowFormValues = z.infer<typeof quotationRowSchema>;
export type QuotationHeaderFormValues = z.infer<typeof quotationHeaderSchema>;
