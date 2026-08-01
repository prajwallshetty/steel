import { createElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { QuotationPdfDocument } from "./QuotationPdfDocument";
import { calculateQuotation } from "@/lib/quotation-engine";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { REFERENCE_QUOTATION } from "@/lib/fixtures/reference-quotation";

const settings = {
  ...DEFAULT_SETTINGS,
  display: { numberGrouping: "none" as const },
};
const quotation = calculateQuotation(REFERENCE_QUOTATION, settings);

/**
 * The PDF is the deliverable, so it is asserted on directly rather than
 * assumed: it must be a real PDF, it must be A4 landscape, and its figures must
 * survive as text — which is only true if they were drawn with text operators
 * rather than rasterised into an image.
 *
 * Written with `createElement` rather than JSX so the suite does not depend on
 * a JSX transform; `tsconfig.json` is owned by Next and pinned to "preserve".
 */
describe("vector PDF", () => {
  // `renderToBuffer` is typed against a `<Document>` root. The component
  // returns exactly that, but the wrapper erases it, so it is restated here.
  const rendered = renderToBuffer(
    createElement(QuotationPdfDocument, {
      quotation,
      settings,
    }) as ReactElement<DocumentProps>,
  );

  it("produces a valid PDF document", async () => {
    const pdf = await rendered;
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("is a single A4 landscape page", async () => {
    const raw = (await rendered).toString("latin1");
    const mediaBox = /MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(raw);
    expect(mediaBox).not.toBeNull();

    // A4 landscape in PDF points. Compared numerically because the writer
    // emits full float precision (841.890015), not a rounded literal.
    const [, width, height] = mediaBox!;
    expect(Number(width)).toBeCloseTo(841.89, 1);
    expect(Number(height)).toBeCloseTo(595.28, 1);

    expect((raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  });

  it("embeds the figures as selectable text, not an image", async () => {
    const raw = (await rendered).toString("latin1");
    expect(raw).not.toMatch(/\/Subtype\s*\/Image/);
    // Standard-14 fonts: nothing outlined, nothing rasterised.
    expect(raw).toMatch(/\/BaseFont\s*\/Helvetica/);
  });

  it("names the party in its document metadata", async () => {
    const raw = (await rendered).toString("latin1");
    expect(raw).toContain("SADGURU TRADERS");
  });
});
