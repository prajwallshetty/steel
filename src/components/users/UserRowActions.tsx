"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserStatus } from "@prisma/client";
import { KeyRound, Loader2, Power, Trash2 } from "lucide-react";
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
import {
  deleteUserAction,
  resetUserPasswordAction,
  setUserStatusAction,
} from "@/modules/users/user-actions";

export function UserRowActions({
  id,
  name,
  status,
  isSelf,
  canDisable,
  canReset,
  canDelete,
}: {
  readonly id: string;
  readonly name: string;
  readonly status: UserStatus;
  readonly isSelf: boolean;
  readonly canDisable: boolean;
  readonly canReset: boolean;
  readonly canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);

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
    <>
      <div className="flex items-center justify-end gap-1">
        {canReset && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Reset password for ${name}`}
            title="Reset password"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await resetUserPasswordAction(id);
                if (!result.ok) {
                  toast.error("Could not reset", { description: result.error });
                  return;
                }
                // Shown once, here. It is never stored in plaintext or logged.
                setTempPassword(result.data.password);
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
          </Button>
        )}

        {canDisable && !isSelf && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              status === UserStatus.ACTIVE ? `Disable ${name}` : `Enable ${name}`
            }
            title={status === UserStatus.ACTIVE ? "Disable" : "Enable"}
            disabled={pending}
            onClick={() =>
              run(
                status === UserStatus.ACTIVE ? "User disabled" : "User enabled",
                () =>
                  setUserStatusAction(
                    id,
                    status === UserStatus.ACTIVE
                      ? UserStatus.DISABLED
                      : UserStatus.ACTIVE,
                  ),
              )
            }
          >
            <Power
              className={status === UserStatus.ACTIVE ? "text-destructive" : ""}
            />
          </Button>
        )}

        {canDelete && !isSelf && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${name}`}
            disabled={pending}
            onClick={() => run("User deleted", () => deleteUserAction(id))}
          >
            <Trash2 className="text-destructive" />
          </Button>
        )}
      </div>

      <Dialog
        open={tempPassword !== null}
        onOpenChange={(open) => !open && setTempPassword(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password for {name}</DialogTitle>
            <DialogDescription>
              Copy this now — it is shown once and cannot be retrieved again.
              All of {name}&apos;s existing sessions have been signed out.
            </DialogDescription>
          </DialogHeader>

          <p className="rounded-md border bg-muted px-4 py-3 text-center font-mono text-lg tracking-wider">
            {tempPassword}
          </p>

          <DialogFooter>
            <Button
              onClick={() => {
                if (tempPassword) {
                  void navigator.clipboard?.writeText(tempPassword);
                  toast.success("Copied to clipboard");
                }
                setTempPassword(null);
              }}
            >
              Copy and close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
