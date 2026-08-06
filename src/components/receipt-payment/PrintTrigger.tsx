"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintTrigger({ backHref, backLabel }: { readonly backHref: string; readonly backLabel: string }) {
  const router = useRouter();
  const hasPrinted = useRef(false);

  useEffect(() => {
    if (hasPrinted.current) return;
    hasPrinted.current = true;

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="print-hidden flex items-center justify-between gap-3 border-b bg-muted/40 px-6 py-3">
      <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
        <ArrowLeft className="size-4 mr-2" />
        {backLabel}
      </Button>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          A4 Portrait · Disable headers & footers for a clean print
        </span>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4 mr-2" />
          Print
        </Button>
      </div>
    </div>
  );
}
