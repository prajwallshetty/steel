import * as React from "react";
import { ShimmerSkeleton, ShimmerCardGrid } from "@/components/ui/skeleton-shimmer";

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <ShimmerSkeleton className="h-9 w-64 rounded-lg" />
        <ShimmerSkeleton className="h-4 w-96 rounded-md" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="rounded-xl border border-border/80 bg-card p-4">
        <div className="flex gap-4">
          <ShimmerSkeleton className="h-10 w-44 rounded-lg" />
          <ShimmerSkeleton className="h-10 w-44 rounded-lg" />
        </div>
      </div>

      {/* Balance Cards */}
      <div className="space-y-3">
        <ShimmerSkeleton className="h-4 w-36 rounded-sm" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-6 shadow-xs">
              <div className="space-y-2 min-w-0">
                <ShimmerSkeleton className="h-3.5 w-24" />
                <ShimmerSkeleton className="h-8 w-32" />
                <ShimmerSkeleton className="h-3 w-40" />
              </div>
              <ShimmerSkeleton className="size-12 rounded-xl shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="space-y-3">
        <ShimmerSkeleton className="h-4 w-36 rounded-sm" />
        <ShimmerCardGrid count={4} />
      </div>

      {/* Split Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border/80 bg-card p-6 space-y-4 shadow-xs">
          <ShimmerSkeleton className="h-6 w-48 rounded-md" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div key={rowIndex} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <div className="space-y-1.5">
                  <ShimmerSkeleton className="h-4 w-40" />
                  <ShimmerSkeleton className="h-3 w-24" />
                </div>
                <ShimmerSkeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-6 space-y-4 shadow-xs">
          <ShimmerSkeleton className="h-6 w-32 rounded-md" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <ShimmerSkeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

