"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LedgerDirection, LedgerStatus } from "@prisma/client";
import { Loader2, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  deletePartnerPaymentAction,
} from "@/modules/receipt-payment/partner-payment-actions";

export function PartnerPaymentRowActions({
  id,
  reference,
  direction,
  canDelete,
  editTrigger,
}: {
  readonly id: string;
  readonly reference: string;
  readonly direction: LedgerDirection;
  readonly canDelete: boolean;
  /** Rendered before Delete when the caller has an edit action for this row. */
  readonly editTrigger?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`Are you sure you want to delete transaction ${reference}?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deletePartnerPaymentAction(id);
      if (!result.ok) {
        toast.error("Could not delete", { description: result.error });
        return;
      }
      toast.success("Transaction deleted");
      router.refresh();
    });
  };

  // If CREDIT (Receipt), link to receipts print; if DEBIT (Payment), link to payments print
  const printUrl = direction === LedgerDirection.CREDIT
    ? `/receipts/${id}/print`
    : `/payments/${id}/print`;

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        title="Print Voucher"
        render={<Link href={printUrl} target="_blank" />}
      >
        <Printer className="size-4 text-muted-foreground hover:text-foreground" />
      </Button>

      {editTrigger}

      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${reference}`}
          disabled={pending}
          onClick={handleDelete}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4 text-destructive" />
          )}
        </Button>
      )}
    </div>
  );
}
