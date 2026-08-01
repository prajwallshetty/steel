"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  Loader2,
  SendHorizonal,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { QuotationStatus } from "@/types/quotation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteQuotationAction,
  duplicateQuotationAction,
  transitionQuotationAction,
} from "@/modules/quotations/quotation-actions";

interface QuotationWorkflowActionsProps {
  readonly id: string;
  readonly status: QuotationStatus;
  readonly canApprove: boolean;
  readonly canDelete: boolean;
  readonly canCreate: boolean;
  readonly canEdit: boolean;
}

/**
 * Workflow controls.
 *
 * Which buttons appear follows the same transition table the service enforces,
 * so the UI cannot offer a move the server will reject. The server remains the
 * authority — this only avoids showing a dead end.
 */
export function QuotationWorkflowActions({
  id,
  status,
  canApprove,
  canDelete,
  canCreate,
  canEdit,
}: QuotationWorkflowActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const run = (
    label: string,
    operation: () => Promise<{ ok: boolean; error?: string }>,
    onSuccess?: () => void,
  ) => {
    startTransition(async () => {
      const result = await operation();
      if (!result.ok) {
        toast.error(label, { description: result.error });
        return;
      }
      toast.success(label);
      onSuccess?.();
      router.refresh();
    });
  };

  const transition = (target: QuotationStatus, label: string, why?: string) =>
    run(label, () =>
      transitionQuotationAction(id, { status: target, reason: why }),
    );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" && canEdit && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => transition("PENDING_APPROVAL", "Sent for approval")}
          >
            {pending ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
            Send for approval
          </Button>
        )}

        {status === "REJECTED" && canEdit && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => transition("PENDING_APPROVAL", "Re-submitted")}
          >
            {pending ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
            Re-submit
          </Button>
        )}

        {status === "PENDING_APPROVAL" && canApprove && (
          <>
            <Button
              disabled={pending}
              onClick={() => transition("APPROVED", "Quotation approved")}
            >
              {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Approve
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setRejectOpen(true)}
            >
              <XCircle />
              Reject
            </Button>
          </>
        )}

        {status === "APPROVED" && canApprove && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => transition("COMPLETED", "Marked complete")}
          >
            {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Mark complete
          </Button>
        )}

        {canCreate && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              run("Quotation duplicated", () => duplicateQuotationAction(id))
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Copy />}
            Duplicate
          </Button>
        )}

        {canDelete && status !== "APPROVED" && status !== "COMPLETED" && (
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={pending}
            onClick={() =>
              run("Quotation deleted", () => deleteQuotationAction(id), () =>
                router.push("/quotations"),
              )
            }
          >
            <Trash2 />
            Delete
          </Button>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this quotation</DialogTitle>
            <DialogDescription>
              The reason is sent to the manager who raised it and recorded in
              the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Rate does not match the approved scheme…"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || reason.trim().length === 0}
              onClick={() => {
                setRejectOpen(false);
                transition("REJECTED", "Quotation rejected", reason.trim());
                setReason("");
              }}
            >
              {pending ? <Loader2 className="animate-spin" /> : <XCircle />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
