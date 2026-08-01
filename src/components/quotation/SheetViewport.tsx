"use client";

import { useEffect, useRef, useState } from "react";
import type { CalculatedQuotation } from "@/types/quotation";
import type { AppSettings } from "@/types/settings";
import { QuotationSheet } from "./QuotationSheet";
import { CONTENT_WIDTH_MM, PAGE, mmToPx } from "@/lib/template/sheet-template";

interface SheetViewportProps {
  readonly quotation: CalculatedQuotation;
  readonly settings: AppSettings;
}

/** Full paper width including margins, in CSS pixels. */
const PAPER_WIDTH_PX = mmToPx(CONTENT_WIDTH_MM + PAGE.marginMm * 2);

/**
 * Screen wrapper for the sheet.
 *
 * The sheet keeps its true 277mm width — a facsimile that reflows is no longer
 * a facsimile — so on a narrow window it is scaled down as a whole rather than
 * re-laid out. Printing bypasses this entirely; the print stylesheet resets the
 * transform so the PDF is always 1:1.
 */
export function SheetViewport({ quotation, settings }: SheetViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width;
      setScale(Math.min(1, available / PAPER_WIDTH_PX));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <div
        style={{
          height: scale < 1 ? `${scale * PAPER_HEIGHT_ESTIMATE_PX}px` : undefined,
        }}
      >
        <div
          className="steel-sheet-paper origin-top-left"
          style={{
            transform: scale < 1 ? `scale(${scale})` : undefined,
          }}
        >
          <QuotationSheet quotation={quotation} settings={settings} />
        </div>
      </div>
    </div>
  );
}

/**
 * Roughly the rendered height of the paper, used only to reserve layout space
 * while the sheet is scaled (a CSS transform does not shrink its own box).
 */
const PAPER_HEIGHT_ESTIMATE_PX = mmToPx(164 + PAGE.marginMm * 2);
