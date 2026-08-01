"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AppSettings } from "@/types/settings";
import type { SaveResult } from "@/types/actions";
import {
  appSettingsSchema,
  type AppSettingsInput,
} from "@/lib/validation/settings-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toFiniteNumber } from "@/lib/quotation-engine/money";

interface SettingsFormProps {
  readonly settings: AppSettings;
  readonly onSave: (input: AppSettingsInput) => Promise<SaveResult>;
}

/**
 * Master settings.
 *
 * The size list and the difference map are edited together as one array, since
 * a size without a difference is meaningless — keeping them in a single field
 * array makes an inconsistent pair unrepresentable in the form.
 */
export function SettingsForm({ settings, onSave }: SettingsFormProps) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: toFormValues(settings),
  });

  const sizes = useFieldArray({ control, name: "sizeRows" });

  const submit = handleSubmit((values) => {
    startSaving(async () => {
      const result = await onSave(fromFormValues(values));
      if (!result.ok) {
        toast.error("Could not save settings", { description: result.error });
        return;
      }
      toast.success("Settings saved", {
        description: "New defaults apply to future quotations only.",
      });
      router.refresh();
    });
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sizes &amp; diameter differences</CardTitle>
          <CardDescription>
            Listed in the order they print on the sheet. The difference is added
            to the basic rate before tax.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Size</span>
            <span>Difference (₹/MT)</span>
            <span className="sr-only">Remove</span>
          </div>

          {sizes.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-3">
              <Input
                {...register(`sizeRows.${index}.size`)}
                aria-label={`Size ${index + 1}`}
                className="uppercase"
                placeholder="8MM"
              />
              <Controller
                control={control}
                name={`sizeRows.${index}.difference`}
                render={({ field: numberField }) => (
                  <Input
                    inputMode="decimal"
                    aria-label={`Difference for size ${index + 1}`}
                    value={String(numberField.value)}
                    onChange={(event) =>
                      numberField.onChange(toFiniteNumber(event.target.value))
                    }
                    onBlur={numberField.onBlur}
                    className="text-right tabular-nums"
                  />
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove size ${index + 1}`}
                onClick={() => sizes.remove(index)}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          ))}

          {errors.sizeRows?.message && (
            <p className="text-sm text-destructive">{errors.sizeRows.message}</p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => sizes.append({ size: "", difference: 0 })}
          >
            <Plus />
            Add size
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing rules</CardTitle>
          <CardDescription>
            Seeded into new quotation rows. Existing quotations keep the rates
            they were saved with.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <NumberField
            control={control}
            name="pricing.defaultBasicRate"
            label="Default basic rate"
            hint="₹ per MT, net of any scheme deduction"
            error={errors.pricing?.defaultBasicRate?.message}
          />
          <NumberField
            control={control}
            name="pricing.loading"
            label="Loading"
            hint="Added to the diameter difference"
            error={errors.pricing?.loading?.message}
          />
          <NumberField
            control={control}
            name="pricing.gstPercent"
            label="GST %"
            error={errors.pricing?.gstPercent?.message}
          />
          <NumberField
            control={control}
            name="pricing.nominalDiscountPercent"
            label="Nominal CD %"
            hint="Prints in the CD column heading"
            error={errors.pricing?.nominalDiscountPercent?.message}
          />
          <NumberField
            control={control}
            name="pricing.defaultDiscountPercent"
            label="Applied CD %"
            hint="Actually charged on new rows"
            error={errors.pricing?.defaultDiscountPercent?.message}
          />

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Discount applied
            </Label>
            <Controller
              control={control}
              name="pricing.discountBase"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before-gst">
                      Before GST (reduces the taxable value)
                    </SelectItem>
                    <SelectItem value="after-gst">
                      After GST (taxed on the gross)
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Changes the formula pipeline for new quotations.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lists &amp; presentation</CardTitle>
          <CardDescription>
            One entry per line. These appear as suggestions on the quotation
            form.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ListField
            label="Brands"
            error={errors.brandsText?.message}
            {...register("brandsText")}
          />
          <ListField
            label="Locations"
            error={errors.locationsText?.message}
            {...register("locationsText")}
          />
          <ListField
            label="Payment types"
            error={errors.paymentTypesText?.message}
            {...register("paymentTypesText")}
          />

          <div className="space-y-1.5 md:col-span-2">
            <Label
              htmlFor="defaultRemarks"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Default footer note
            </Label>
            <Input id="defaultRemarks" {...register("defaultRemarks")} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Number grouping
            </Label>
            <Controller
              control={control}
              name="display.numberGrouping"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indian">Indian — 6,07,354</SelectItem>
                    <SelectItem value="none">
                      None — 607354 (as the original workbook)
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
          Save settings
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------------------
 * Form shape
 *
 * The stored settings use a size list plus a difference map, and free-text
 * areas are easier to edit than string arrays. The form therefore has its own
 * shape, with explicit mappers at each boundary rather than ad-hoc conversions
 * scattered through the JSX.
 * ------------------------------------------------------------------------ */

const settingsFormSchema = z.object({
  sizeRows: z
    .array(
      z.object({
        size: z.string().trim().min(1, "Size is required"),
        difference: z.number().min(0, "Difference cannot be negative"),
      }),
    )
    .min(1, "Add at least one size")
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        const key = row.size.trim().toUpperCase();
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "size"],
            message: `Duplicate size "${row.size}"`,
          });
        }
        seen.add(key);
      });
    }),
  pricing: appSettingsSchema.shape.pricing,
  display: appSettingsSchema.shape.display,
  brandsText: z.string().trim().min(1, "Add at least one brand"),
  locationsText: z.string().trim().min(1, "Add at least one location"),
  paymentTypesText: z.string().trim().min(1, "Add at least one payment type"),
  defaultRemarks: z.string(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

function toFormValues(settings: AppSettings): SettingsFormValues {
  return {
    sizeRows: settings.sizes.map((size) => ({
      size,
      difference: settings.differences[size] ?? 0,
    })),
    pricing: settings.pricing,
    display: settings.display,
    brandsText: settings.brands.join("\n"),
    locationsText: settings.locations.join("\n"),
    paymentTypesText: settings.paymentTypes.join("\n"),
    defaultRemarks: settings.defaultRemarks,
  };
}

function fromFormValues(values: SettingsFormValues): AppSettingsInput {
  const sizes = values.sizeRows.map((row) => row.size.trim().toUpperCase());
  const differences = Object.fromEntries(
    values.sizeRows.map((row) => [row.size.trim().toUpperCase(), row.difference]),
  );

  return {
    display: values.display,
    sizes,
    differences,
    pricing: values.pricing,
    brands: splitLines(values.brandsText),
    locations: splitLines(values.locationsText),
    paymentTypes: splitLines(values.paymentTypesText),
    // Derived from the difference tiers at render time; no manual list.
    highlightSizes: [],
    defaultRemarks: values.defaultRemarks,
  };
}

const splitLines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/* ------------------------------- small parts ----------------------------- */

function NumberField({
  control,
  name,
  label,
  hint,
  error,
}: {
  readonly control: ReturnType<typeof useForm<SettingsFormValues>>["control"];
  readonly name:
    | "pricing.defaultBasicRate"
    | "pricing.loading"
    | "pricing.gstPercent"
    | "pricing.nominalDiscountPercent"
    | "pricing.defaultDiscountPercent";
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            inputMode="decimal"
            value={String(field.value)}
            onChange={(event) => field.onChange(toFiniteNumber(event.target.value))}
            onBlur={field.onBlur}
            aria-label={label}
            className="text-right tabular-nums"
          />
        )}
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const ListField = function ListField({
  label,
  error,
  ...props
}: React.ComponentProps<typeof Textarea> & {
  readonly label: string;
  readonly error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Textarea rows={5} className="uppercase" {...props} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
