"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LedgerStatus } from "@prisma/client";
import { Check, Loader2, Printer, Trash2, Undo2, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  deleteReceiptAction,
} from "@/modules/receipt-payment/receipt-payment-actions";
import {
  setLedgerStatusAction,
} from "@/modules/ledger/ledger-actions";

export function ReceiptRowActions({
  id,
  reference,
  status,
  canApprove,
  canDelete,
}: {
  readonly id: string;
  readonly reference: string;
  readonly status: LedgerStatus;
  readonly canApprove: boolean;
  readonly canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (
    label: string,
    operation: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    if (label.includes("delete") && !confirm(`Are you sure you want to delete receipt ${reference}?`)) {
      return;
    }
    startTransition(async () => {
      const result = await operation();
      if (!result.ok) {
        toast.error("Could not update", { description: result.error });
        return;
      }
      toast.success(label);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        title="Print Receipt"
        render={<Link href={`/receipts/${id}/print`} target="_blank" />}
      >
        <Printer className="size-4 text-muted-foreground hover:text-foreground" />
      </Button>

      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${reference}`}
          disabled={pending}
          onClick={() =>
            run("Receipt deleted", () => deleteReceiptAction(id))
          }
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
