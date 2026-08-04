"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { QuotationStatus } from "@prisma/client";
import { updateQuotationStatusAction } from "@/modules/quotations/quotation-actions";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 hover:bg-blue-100/50 dark:hover:bg-blue-950/60",
  warning:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 hover:bg-amber-100/50 dark:hover:bg-amber-950/60",
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/60",
  danger:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900 hover:bg-red-100/50 dark:hover:bg-red-950/60",
} as const;

type Tone = keyof typeof TONES;

const STATUS_DETAILS: Record<QuotationStatus, { tone: Tone; label: string }> = {
  DRAFT: { tone: "neutral", label: "Draft" },
  PENDING_APPROVAL: { tone: "warning", label: "Pending approval" },
  APPROVED: { tone: "success", label: "Approved" },
  REJECTED: { tone: "danger", label: "Rejected" },
  COMPLETED: { tone: "info", label: "Completed" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
};

export function QuotationStatusSelector({
  id,
  currentStatus,
}: {
  readonly id: string;
  readonly currentStatus: QuotationStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleChange = (status: QuotationStatus) => {
    if (status === currentStatus) return;

    startTransition(async () => {
      const result = await updateQuotationStatusAction(id, status);
      if (!result.ok) {
        toast.error("Failed to update status", { description: result.error });
        return;
      }
      toast.success(`Quotation status updated to ${STATUS_DETAILS[status].label}`);
      router.refresh();
    });
  };

  const current = STATUS_DETAILS[currentStatus];

  return (
    <div className="relative inline-flex items-center">
      {pending ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-semibold bg-muted text-muted-foreground border-border select-none">
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
          Updating...
        </span>
      ) : (
        <div className="relative inline-block">
          <select
            value={currentStatus}
            onChange={(e) => handleChange(e.target.value as QuotationStatus)}
            disabled={pending}
            className={cn(
              "appearance-none cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 pr-8 text-[12px] font-bold capitalize tracking-wide transition-all outline-none focus:ring-2 focus:ring-ring/20 shadow-sm",
              TONES[current.tone]
            )}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234b5563' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E")`,
              backgroundPosition: "right 10px center",
              backgroundSize: "10px",
              backgroundRepeat: "no-repeat",
            }}
          >
            {Object.entries(STATUS_DETAILS).map(([value, details]) => (
              <option
                key={value}
                value={value}
                className="bg-card text-foreground text-xs font-semibold py-1"
              >
                {details.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
