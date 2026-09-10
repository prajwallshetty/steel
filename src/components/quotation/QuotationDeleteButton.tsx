"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteQuotationAction } from "@/modules/quotations/quotation-actions";

export function QuotationDeleteButton({
  id,
  reference,
}: {
  readonly id: string;
  readonly reference: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`Delete quotation ${reference}? This cannot be undone from here.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteQuotationAction(id);
      if (!result.ok) {
        toast.error("Could not delete", { description: result.error });
        return;
      }
      toast.success("Quotation deleted");
      router.refresh();
    });
  };

  return (
    <Button
      variant="ghost"
      size="xs"
      className="opacity-0 group-hover:opacity-100 hover:bg-accent/80 transition-all font-semibold text-destructive hover:text-destructive"
      disabled={pending}
      onClick={handleDelete}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      Delete
    </Button>
  );
}
