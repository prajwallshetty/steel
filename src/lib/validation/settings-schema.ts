import { z } from "zod";

const nonNegative = (label: string) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .finite(`${label} must be a valid number`)
    .min(0, { message: `${label} cannot be negative` });

const percent = (label: string) =>
  nonNegative(label).max(100, { message: `${label} cannot exceed 100%` });

const nonEmptyList = (label: string) =>
  z.array(z.string().trim().min(1)).min(1, `Add at least one ${label}`);

export const appSettingsSchema = z.object({
  display: z.object({
    numberGrouping: z.enum(["indian", "none"]),
  }),
  sizes: nonEmptyList("size").superRefine((sizes, ctx) => {
    const seen = new Set<string>();
    sizes.forEach((size, index) => {
      if (seen.has(size)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: `Duplicate size "${size}"`,
        });
      }
      seen.add(size);
    });
  }),
  differences: z.record(z.string(), nonNegative("Difference")),
  pricing: z.object({
    defaultBasicRate: nonNegative("Basic rate"),
    gstPercent: percent("GST"),
    nominalDiscountPercent: percent("Nominal discount"),
    defaultDiscountPercent: percent("Default discount"),
    loading: nonNegative("Loading"),
    discountBase: z.enum(["before-gst", "after-gst"]),
  }),
  brands: nonEmptyList("brand"),
  locations: nonEmptyList("location"),
  paymentTypes: nonEmptyList("payment type"),
  highlightSizes: z.array(z.string().trim().min(1)),
  defaultRemarks: z.string(),
});

export type AppSettingsInput = z.infer<typeof appSettingsSchema>;
