import * as React from "react";
import { ShimmerSkeleton, ShimmerTableRow } from "@/components/ui/skeleton-shimmer";

export default function CustomersLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <ShimmerSkeleton className="h-9 w-64 rounded-lg" />
          <ShimmerSkeleton className="h-4 w-80 rounded-md" />
        </div>
        <ShimmerSkeleton className="h-12 w-36 rounded-lg" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="rounded-xl border border-border/80 bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <ShimmerSkeleton className="h-3 w-16" />
            <ShimmerSkeleton className="h-10 w-64 rounded-md" />
          </div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {Array.from({ length: 5 }).map((_, index) => (
                  <th key={index} className="h-12 px-6 py-3 text-left">
                    <ShimmerSkeleton className="h-4 w-24" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, rowIndex) => (
                <ShimmerTableRow key={rowIndex} cols={5} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

