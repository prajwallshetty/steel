"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveBranchAction } from "@/modules/branches/branch-actions";

/**
 * Archiving is confirmed explicitly because it also disables every user in the
 * branch and revokes their sessions — a bigger blast radius than the single
 * click suggests.
 */
export function ArchiveBranchButton({
  id,
  name,
  userCount,
}: {
  readonly id: string;
  readonly name: string;
  readonly userCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Archive ${name}`}
        title={`Archive ${name}`}
        onClick={() => setOpen(true)}
      >
        <Archive className="text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {name}?</DialogTitle>
            <DialogDescription>
              The branch stops accepting new quotations and ledger entries.
              {userCount > 0 && (
                <>
                  {" "}
                  Its {userCount} user{userCount === 1 ? "" : "s"} will be
                  disabled and signed out immediately.
                </>
              )}{" "}
              Existing records are kept and stay readable.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await archiveBranchAction(id);
                  if (!result.ok) {
                    toast.error("Could not archive", { description: result.error });
                    return;
                  }
                  toast.success(`${name} archived`);
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Archive />}
              Archive branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
