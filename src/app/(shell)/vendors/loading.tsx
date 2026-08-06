import * as React from "react";

export default function VendorsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-9 w-40 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-5 w-64 animate-pulse rounded-md bg-neutral-100" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-md bg-neutral-100" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border border-border/80 bg-white overflow-hidden">
        <div className="border-b bg-neutral-50 px-6 py-4">
          <div className="h-6 w-32 animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="flex items-center justify-between border-b border-neutral-100 pb-4 last:border-0 last:pb-0"
            >
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse rounded bg-neutral-100" />
                <div className="h-4 w-56 animate-pulse rounded bg-neutral-100" />
              </div>
              <div className="h-5 w-28 animate-pulse rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
