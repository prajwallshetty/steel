"use client";

import dynamic from "next/dynamic";
import * as React from "react";

const LazyEditor = dynamic(
  () => import("./QuotationEditor").then((mod) => mod.QuotationEditor),
  {
    ssr: false,
    loading: () => <div className="h-96 w-full animate-pulse rounded-xl bg-neutral-50 border border-neutral-100" />,
  }
);

export function QuotationEditor(props: React.ComponentProps<typeof LazyEditor>) {
  return <LazyEditor {...props} />;
}
