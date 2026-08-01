"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Opens the browser print dialog once the sheet has painted.
 *
 * `requestAnimationFrame` is deliberate: firing `print()` during commit can
 * capture the page before web fonts and the mm-based grid have settled, which
 * shows up as a shifted first page. The manual button remains for a re-print
 * without a round trip.
 */
export function PrintTrigger({ backHref }: { readonly backHref: string }) {
  const router = useRouter();
  const hasPrinted = useRef(false);

  useEffect(() => {
    if (hasPrinted.current) return;
    hasPrinted.current = true;

    const frame = requestAnimationFrame(() => {
      // A second frame guarantees layout has flushed, not just been scheduled.
      requestAnimationFrame(() => window.print());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="print-hidden flex items-center justify-between gap-3 border-b bg-muted/40 px-6 py-3">
      <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
        <ArrowLeft />
        Back to quotation
      </Button>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          A4 landscape · 10&nbsp;mm margins · disable “headers and footers” in
          the print dialog for an exact match
        </span>
        <Button size="sm" onClick={() => window.print()}>
          <Printer />
          Print
        </Button>
      </div>
    </div>
  );
}
