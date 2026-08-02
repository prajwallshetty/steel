import * as React from "react";

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-12">
      {/* Header Skeleton */}
      <div className="space-y-3">
        <div className="h-12 w-96 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-5 w-128 animate-pulse rounded-lg bg-neutral-100" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-6 overflow-hidden rounded-xl border border-border/80 bg-white p-8"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 animate-pulse rounded-md bg-neutral-100" />
              <div className="size-5 animate-pulse rounded-full bg-neutral-100" />
            </div>
            <div className="space-y-2">
              <div className="h-9 w-24 animate-pulse rounded-lg bg-neutral-100" />
              <div className="h-4 w-40 animate-pulse rounded-md bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Split Layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Table/Activity Skeleton */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border/80 bg-white p-8 space-y-6">
            <div className="h-7 w-48 animate-pulse rounded-lg bg-neutral-100" />
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                  <div className="space-y-2">
                    <div className="h-5 w-40 animate-pulse rounded-md bg-neutral-100" />
                    <div className="h-4 w-24 animate-pulse rounded-md bg-neutral-100" />
                  </div>
                  <div className="h-6 w-16 animate-pulse rounded-full bg-neutral-100" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Actions & Help Skeleton */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border/80 bg-white p-8 space-y-6">
            <div className="h-7 w-32 animate-pulse rounded-lg bg-neutral-100" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-12 w-full animate-pulse rounded-lg bg-neutral-100" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
