"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LedgerStatus } from "@prisma/client";
import { Check, Loader2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  deleteLedgerEntryAction,
  setLedgerStatusAction,
} from "@/modules/ledger/ledger-actions";

export function LedgerRowActions({
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
  ) =>
    startTransition(async () => {
      const result = await operation();
      if (!result.ok) {
        toast.error("Could not update", { description: result.error });
        return;
      }
      toast.success(label);
      router.refresh();
    });

  return (
    <div className="flex items-center justify-end gap-1">
      {canApprove && status === LedgerStatus.PENDING && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Approve ${reference}`}
          title="Mark received"
          disabled={pending}
          onClick={() =>
            run("Entry approved", () =>
              setLedgerStatusAction(id, LedgerStatus.RECEIVED),
            )
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
        </Button>
      )}

      {canApprove && status === LedgerStatus.RECEIVED && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Clear ${reference}`}
          title="Mark cleared"
          disabled={pending}
          onClick={() =>
            run("Entry cleared", () =>
              setLedgerStatusAction(id, LedgerStatus.CLEARED),
            )
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
        </Button>
      )}

      {canApprove && status === LedgerStatus.RECEIVED && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Return ${reference}`}
          title="Mark returned"
          disabled={pending}
          onClick={() =>
            run("Entry marked returned", () =>
              setLedgerStatusAction(id, LedgerStatus.RETURNED),
            )
          }
        >
          <Undo2 />
        </Button>
      )}

      {/* A cleared entry is reconciled; the service refuses deletion, so the
          control is withheld rather than offered and rejected. */}
      {canDelete && status !== LedgerStatus.CLEARED && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${reference}`}
          disabled={pending}
          onClick={() =>
            run("Entry deleted", () => deleteLedgerEntryAction(id))
          }
        >
          <Trash2 className="text-destructive" />
        </Button>
      )}
    </div>
  );
}
