import { cn } from "@/lib/utils";

/**
 * Status pills.
 *
 * Colour is paired with the label text rather than carrying meaning alone, so
 * the state is still readable to anyone who cannot distinguish the hues.
 */
const TONES = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  warning:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  danger:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
} as const;

type Tone = keyof typeof TONES;

const QUOTATION_TONES: Record<string, { tone: Tone; label: string }> = {
  DRAFT: { tone: "neutral", label: "Draft" },
  PENDING_APPROVAL: { tone: "warning", label: "Pending approval" },
  APPROVED: { tone: "success", label: "Approved" },
  REJECTED: { tone: "danger", label: "Rejected" },
  COMPLETED: { tone: "info", label: "Completed" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
};

const LEDGER_TONES: Record<string, { tone: Tone; label: string }> = {
  PENDING: { tone: "warning", label: "Pending" },
  RECEIVED: { tone: "info", label: "Received" },
  CLEARED: { tone: "success", label: "Cleared" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
  RETURNED: { tone: "danger", label: "Returned" },
};

const GENERIC_TONES: Record<string, { tone: Tone; label: string }> = {
  ACTIVE: { tone: "success", label: "Active" },
  INACTIVE: { tone: "warning", label: "Inactive" },
  ARCHIVED: { tone: "neutral", label: "Archived" },
  DISABLED: { tone: "danger", label: "Disabled" },
};

export function StatusBadge({
  status,
  kind = "quotation",
  className,
}: {
  readonly status: string;
  readonly kind?: "quotation" | "ledger" | "generic";
  readonly className?: string;
}) {
  const table =
    kind === "ledger"
      ? LEDGER_TONES
      : kind === "generic"
        ? GENERIC_TONES
        : QUOTATION_TONES;

  const entry = table[status] ?? {
    tone: "neutral" as Tone,
    label: status.replace(/_/g, " ").toLowerCase(),
  };

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-semibold capitalize tracking-wide transition-colors",
        TONES[entry.tone],
        className,
      )}
    >
      {entry.label}
    </span>
  );
}
