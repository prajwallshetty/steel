"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type { ActionResult } from "@/modules/shared/action-result";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * `TTransformed` is the shape a resolver produces, which react-hook-form tracks
 * separately from the raw field values. Naming it here lets a schema with
 * defaults or coercions flow through without the caller needing a cast.
 */
interface EntityDialogProps<
  T extends FieldValues,
  TTransformed extends FieldValues = T,
> {
  readonly trigger: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly form: UseFormReturn<T, unknown, TTransformed>;
  readonly onSubmit: (values: TTransformed) => Promise<ActionResult<{ id: string }>>;
  readonly successMessage: string;
  readonly submitLabel?: string;
  readonly children: ReactNode;
  readonly onSuccess?: (id: string) => void;
  readonly wide?: boolean;
}

/**
 * Shared create/edit dialog.
 *
 * Centralises the parts every entity form repeats: submit state, mapping
 * server-side field errors back onto the form, toasting, and refreshing the
 * route so the list behind the dialog reflects the write.
 *
 * Server field errors are re-applied to the form rather than only toasted —
 * a duplicate username should light up the username input, not just flash a
 * message the user has to interpret.
 */
export function EntityDialog<
  T extends FieldValues,
  TTransformed extends FieldValues = T,
>({
  trigger,
  title,
  description,
  form,
  onSubmit,
  successMessage,
  submitLabel = "Save",
  children,
  onSuccess,
  wide = false,
}: EntityDialogProps<T, TTransformed>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const result = await onSubmit(values);

      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [path, message] of Object.entries(result.fieldErrors)) {
            form.setError(path as never, { type: "server", message });
          }
        }
        toast.error("Could not save", { description: result.error });
        return;
      }

      toast.success(successMessage);
      setOpen(false);
      form.reset();
      onSuccess?.(result.data.id);
      router.refresh();
    } finally {
      setSaving(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className={wide ? "sm:max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-0.5">
            {children}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
