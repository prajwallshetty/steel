"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteCustomerAction } from "@/modules/customers/customer-actions";

export function CustomerRowActions({
  id,
  name,
  quotationCount,
}: {
  readonly id: string;
  readonly name: string;
  readonly quotationCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // A customer with history cannot be removed; the service refuses it, and
  // disabling here avoids offering an action that will always fail.
  const blocked = quotationCount > 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Delete ${name}`}
      title={
        blocked
          ? `${name} is referenced by ${quotationCount} quotation${quotationCount === 1 ? "" : "s"}`
          : `Delete ${name}`
      }
      disabled={pending || blocked}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteCustomerAction(id);
          if (!result.ok) {
            toast.error("Could not delete", { description: result.error });
            return;
          }
          toast.success(`${name} deleted`);
          router.refresh();
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Trash2 className={blocked ? undefined : "text-destructive"} />
      )}
    </Button>
  );
}
