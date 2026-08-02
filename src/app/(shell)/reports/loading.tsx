import * as React from "react";

export default function ReportsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-12">
      {/* Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="h-12 w-96 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-5 w-128 animate-pulse rounded-lg bg-neutral-100" />
        </div>
        <div className="h-13 w-40 animate-pulse rounded-lg bg-neutral-100" />
      </div>

      {/* Analytics Filters Panel Skeleton */}
      <div className="rounded-xl border border-border/80 bg-white p-8">
        <div className="flex flex-wrap items-end gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
              <div className="h-13 w-48 animate-pulse rounded-lg bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>

      {/* Analytics KPI Summary Row */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-6 overflow-hidden rounded-xl border border-border/80 bg-white p-8"
          >
            <div className="h-5 w-32 animate-pulse rounded-md bg-neutral-100" />
            <div className="h-9 w-24 animate-pulse rounded-lg bg-neutral-100" />
          </div>
        ))}
      </div>

      {/* Reports Table Skeleton */}
      <div className="rounded-xl border border-border/80 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-neutral-50/50">
                {Array.from({ length: 5 }).map((_, index) => (
                  <th key={index} className="h-14 px-6 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/40 last:border-0">
                  {Array.from({ length: 5 }).map((_, cellIndex) => (
                    <td key={cellIndex} className="p-6">
                      <div className="h-4 w-full max-w-[150px] animate-pulse rounded bg-neutral-100" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
