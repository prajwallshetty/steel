"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import type { ReportKind } from "@/modules/reports/report-service";

/**
 * Report selector.
 *
 * Switching reports preserves the active date/branch filters, so comparing the
 * same period across reports does not mean re-entering the range each time.
 */
export function ReportTabs({
  reports,
  active,
}: {
  readonly reports: readonly { key: ReportKind; label: string }[];
  readonly active: ReportKind;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="tablist"
      aria-label="Report type"
      className="flex flex-wrap gap-1 rounded-lg border bg-card p-1"
    >
      {reports.map((report) => {
        const selected = report.key === active;
        return (
          <button
            key={report.key}
            role="tab"
            type="button"
            aria-selected={selected}
            disabled={pending}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("kind", report.key);
              startTransition(() => {
                router.replace(`${pathname}?${params.toString()}`);
              });
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {report.label}
          </button>
        );
      })}
    </div>
  );
}
