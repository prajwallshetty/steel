import * as React from "react";
import { cn } from "@/lib/utils";

interface ShimmerProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly className?: string;
}

/**
 * Unified shimmer skeleton primitive.
 * Uses modern linear keyframe gradient shimmer animation for instant perceived loading.
 */
export function ShimmerSkeleton({ className, ...props }: ShimmerProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted animate-shimmer gpu-accelerated select-none pointer-events-none",
        className
      )}
      {...props}
    />
  );
}

/** Skeleton row for tables */
export function ShimmerTableRow({ cols = 5 }: { readonly cols?: number }) {
  return (
    <tr className="border-b border-border/30 last:border-b-0">
      {Array.from({ length: cols }).map((_, index) => (
        <td key={index} className="px-6 py-4">
          <ShimmerSkeleton
            className={cn(
              "h-5 rounded-md",
              index === 0
                ? "w-24 font-mono"
                : index === cols - 1
                ? "w-16 ml-auto"
                : "w-36"
            )}
          />
        </td>
      ))}
    </tr>
  );
}

/** Skeleton grid for cards */
export function ShimmerCardGrid({ count = 4 }: { readonly count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-6 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <ShimmerSkeleton className="h-4 w-28" />
            <ShimmerSkeleton className="size-8 rounded-lg" />
          </div>
          <div className="space-y-2">
            <ShimmerSkeleton className="h-8 w-36" />
            <ShimmerSkeleton className="h-3.5 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}
