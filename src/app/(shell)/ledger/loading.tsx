import * as React from "react";

export default function LedgerLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-9 w-48 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-5 w-64 animate-pulse rounded-md bg-neutral-100" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-md bg-neutral-100" />
      </div>

      {/* Filter Bar Card Skeleton */}
      <div className="rounded-xl border border-border/80 bg-white p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>

      {/* Balance Summary Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/80 bg-white p-5 space-y-3">
            <div className="h-4 w-28 animate-pulse rounded bg-neutral-100" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-neutral-100" />
          </div>
        ))}
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
              <div className="flex gap-4 items-center">
                <div className="h-5 w-20 animate-pulse rounded bg-neutral-100" />
                <div className="space-y-1.5">
                  <div className="h-5 w-48 animate-pulse rounded bg-neutral-100" />
                  <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
                </div>
              </div>
              <div className="flex gap-8">
                <div className="h-5 w-20 animate-pulse rounded bg-neutral-100" />
                <div className="h-5 w-20 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
