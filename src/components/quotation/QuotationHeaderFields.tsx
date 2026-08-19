"use client";

import { Controller, useWatch, type Control, type FieldErrors } from "react-hook-form";
import type { AppSettings } from "@/types/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboInput } from "@/components/ui/combo-input";
import type { QuotationDraftInput } from "@/lib/validation/quotation-schema";

interface QuotationHeaderFieldsProps {
  readonly control: any;
  readonly errors: any;
  readonly settings: AppSettings;
  readonly disabled?: boolean;
  readonly setValue: any;
  readonly getValues: any;
  readonly customers: readonly { id: string; name: string; city?: string | null; address?: string | null }[];
}

/** The eight header cells of the sheet, as a form. */
export function QuotationHeaderFields({
  control,
  errors,
  settings,
  disabled = false,
  setValue,
  getValues,
  customers,
}: QuotationHeaderFieldsProps) {
  const headerErrors = errors.header;
  const basicRateLabelValue = useWatch({ control, name: "header.basicRateLabel" }) || "";

  const [basicVal, diffVal] = (() => {
    const clean = String(basicRateLabelValue).trim();
    const dashMatch = clean.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (dashMatch) {
      return [dashMatch[1], dashMatch[2]];
    }
    const singleMatch = clean.match(/^(\d+(?:\.\d+)?)/);
    if (singleMatch) {
      return [singleMatch[1], "4000"];
    }
    return ["", "4000"];
  })();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label="Date" error={headerErrors?.date?.message} required>
        <Controller
          control={control}
          name="header.date"
          render={({ field }) => (
            <Input type="date" disabled={disabled} {...field} />
          )}
        />
      </Field>

      <Field label="Location" error={headerErrors?.location?.message} required>
        <Controller
          control={control}
          name="header.location"
          render={({ field }) => (
            <ComboInput
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={settings.locations}
              disabled={disabled}
              placeholder="GHOTWADE"
            />
          )}
        />
      </Field>

      <Field
        label="Party name"
        error={headerErrors?.partyName?.message}
        required
      >
        <Controller
          control={control}
          name="header.partyName"
          render={({ field }) => {
            const hasMatched = customers.some(
              (c) => c.name.toUpperCase() === (field.value || "").toUpperCase()
            );
            const showFallback = field.value && !hasMatched;

            return (
              <select
                value={field.value || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  field.onChange(val);
                  // Also set customerId and location in the form context if matched
                  const matchedCust = customers.find((c) => c.name === val);
                  setValue("customerId", matchedCust ? matchedCust.id : null, {
                    shouldDirty: true,
                  });
                  if (matchedCust) {
                    const loc = (matchedCust.city || matchedCust.address || "").trim();
                    if (loc) {
                      setValue("header.location", loc.toUpperCase(), {
                        shouldDirty: true,
                      });
                    }
                  }
                }}
                disabled={disabled}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a customer</option>
                {showFallback && (
                  <option value={field.value}>
                    {field.value} (Legacy / Not Linked)
                  </option>
                )}
                {customers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            );
          }}
        />
      </Field>

      <Field label="Brand" error={headerErrors?.brand?.message} required>
        <Controller
          control={control}
          name="header.brand"
          render={({ field }) => (
            <ComboInput
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={settings.brands}
              disabled={disabled}
              placeholder="SHIRDI"
            />
          )}
        />
      </Field>

      <Field
        label="Basic rate"
        error={headerErrors?.basicRateLabel?.message}
        required
        hint="Underlying rate before differences"
      >
        <Input
          type="number"
          inputMode="decimal"
          value={basicVal}
          disabled={disabled}
          placeholder="36300"
          onChange={(e) => {
            const newBasic = e.target.value;
            const combined = newBasic ? `${newBasic}-${diffVal}` : "";
            setValue("header.basicRateLabel", combined, { shouldDirty: true });
            if (newBasic) {
              localStorage.setItem("steel_last_basic_rate", newBasic);
            }
          }}
        />
      </Field>

      <Field
        label="Rate diff"
        required
        hint="Subtracted difference (usually 4000)"
      >
        <Input
          type="number"
          inputMode="decimal"
          value={diffVal}
          disabled={disabled}
          placeholder="4000"
          onChange={(e) => {
            const newDiff = e.target.value || "0";
            const combined = basicVal ? `${basicVal}-${newDiff}` : "";
            setValue("header.basicRateLabel", combined, { shouldDirty: true });
            localStorage.setItem("steel_last_rate_diff", newDiff);
          }}
        />
      </Field>


      <Field
        label="Dia difference"
        error={headerErrors?.diaDiffLabel?.message}
        hint="Caption only — the rates come from each row"
      >
        <Controller
          control={control}
          name="header.diaDiffLabel"
          render={({ field }) => (
            <Input
              {...field}
              disabled={disabled}
              placeholder="6500/5500 +295"
            />
          )}
        />
      </Field>

      <Field label="Payment" error={headerErrors?.payment?.message} required>
        <Controller
          control={control}
          name="header.payment"
          render={({ field }) => (
            <ComboInput
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              options={settings.paymentTypes}
              disabled={disabled}
              placeholder="REGULER"
            />
          )}
        />
      </Field>

      <Field label="Vehicle no." error={headerErrors?.vehicleNo?.message}>
        <Controller
          control={control}
          name="header.vehicleNo"
          render={({ field }) => (
            <Input
              {...field}
              disabled={disabled}
              className="uppercase"
              placeholder="MH 12 AB 1234"
            />
          )}
        />
      </Field>

      <Field
        label="CD% (all rows)"
        error={headerErrors?.cdPercent?.message}
        hint="Updates all row cash discount %"
      >
        <Controller
          control={control}
          name="header.cdPercent"
          render={({ field }) => (
            <Input
              type="number"
              step="any"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
              disabled={disabled}
              placeholder="1.5"
            />
          )}
        />
      </Field>

      <Field
        label="CD Type"
        error={headerErrors?.cdType?.message}
        hint="Cash discount base rate calculation"
      >
        <Controller
          control={control}
          name="header.cdType"
          render={({ field }) => (
            <select
              value={field.value ?? "basic-diff"}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={disabled}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="basic-diff">Basic + Dia Diff (Default)</option>
              <option value="basic">Basic Rate Only</option>
              <option value="gross">Basic + Dia Diff + Loading</option>
            </select>
          )}
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  required = false,
  children,
}: {
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
  readonly required?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
