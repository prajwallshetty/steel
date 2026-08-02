import * as React from "react";

export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-12">
      {/* Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="h-12 w-96 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-5 w-128 animate-pulse rounded-lg bg-neutral-100" />
        </div>
      </div>

      {/* Admin Content Form/Table Shimmer Layout */}
      <div className="rounded-xl border border-border/80 bg-white p-8 space-y-6">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-neutral-100" />
        
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex gap-4">
              <div className="h-10 w-1/3 animate-pulse rounded-lg bg-neutral-50" />
              <div className="h-10 w-2/3 animate-pulse rounded-lg bg-neutral-50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
