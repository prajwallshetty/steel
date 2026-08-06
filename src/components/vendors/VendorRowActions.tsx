"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteVendorAction } from "@/modules/vendors/vendor-actions";

export function VendorRowActions({
  id,
  name,
}: {
  readonly id: string;
  readonly name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Delete ${name}`}
      title={`Delete ${name}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteVendorAction(id);
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
        <Trash2 className="text-destructive" />
      )}
    </Button>
  );
}
