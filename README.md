# Steel Quotation System — Discount / CD

A production-ready quotation system for steel trading. It reproduces the
existing Discount/CD workbook cell-for-cell, prices every row through a
configurable engine, and emits a true vector A4-landscape PDF.

```bash
npm install
npm run dev        # http://localhost:3000
```

On first run the store seeds itself with the reference quotation
(`QT-2026-0001`, SADGURU TRADERS) so the output can be compared against the
original workbook immediately.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Engine + PDF test suite (31 tests) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

---

## The pricing pipeline

Every row resolves independently through the same sequence. Nothing is
hardcoded — each step reads its rate from the row, which is seeded from Admin
settings and can be overridden per quotation.

```
basic
  + (dia difference + loading)   ->  gross rate      "DIFF+ LDG"
  - cash discount                ->  taxable value   "1.5% CD"
  + GST                          ->  final rate      "RATE"
  x quantity                     ->  line total      "TOTAL"
                                     sum -> grand total
```

`pricing.discountBase` flips the discount above or below the tax line without
touching the engine internals or the UI.

### Precision is the load-bearing decision

Intermediate values are carried at **6 decimal places** and rounded **once**,
at the end. This is not incidental — it is what makes the sheet reconcile:

| | |
| --- | --- |
| Sum of unrounded line totals | `101195.679 + 352671.91 + 153486.789` = **607354.378 → 607354** ✅ |
| Sum of *rounded* line totals | `101196 + 352672 + 153487` = **607355** ❌ |

The workbook prints `607354`. Rounding each line before summing is off by a
rupee, so the engine rounds only at the presentation boundary.
`roundFinancial` rounds half **away from zero**, matching Excel's `ROUND()`
rather than JavaScript's `Math.round`, and corrects for IEEE-754 error
(`1.005 * 100` is `100.49999999999999` in binary floating point).

A regression test asserts both figures, so this cannot silently regress.

---

## Architecture

```
src/
  types/                      Domain model. Readonly, framework-free.
  lib/
    quotation-engine/         Pure functions. No React, no I/O.
      calculateRow.ts           one material row
      calculateGST.ts           tax on a taxable value
      calculateDiscount.ts      cash discount
      calculateTotals.ts        aggregation
      calculateQuotation.ts     whole sheet + highlight tiers
      money.ts                  financial rounding, input coercion
    template/sheet-template.ts  Geometry + colours, authored in millimetres
    pdf/                        Vector PDF (@react-pdf/renderer)
    repository/                 Persistence behind an interface
    validation/                 Zod schemas, shared client + server
    format/                     Indian number + date formatting
    actions/                    Server actions
  components/
    quotation/QuotationSheet.tsx   the facsimile (no hooks, no arithmetic)
    quotation/QuotationEditor.tsx  the form
  styles/sheet.css               screen + print, one stylesheet
  app/
    (shell)/                     app chrome
    (print)/quotations/[id]/print  bare print route
```

**The engine never touches the UI, and the UI never does arithmetic.** The
sheet component receives values that are already resolved; the editor calls the
same engine the server does. Swapping in a different pricing model means adding
a module under `quotation-engine/` — no component changes.

### One source of geometry

`sheet-template.ts` holds the column widths, row heights, fills and font sizes
in **millimetres against an A4 landscape page**. The HTML sheet consumes them as
CSS `mm`; the PDF converts them to points. Preview, print and download cannot
drift apart, because there is only one set of numbers.

Verified: the sheet renders at exactly **1046.92 px = 277 mm**, the printable
width of A4 landscape at 10 mm margins.

### Persistence

`QuotationRepository` and `SettingsRepository` are interfaces. The shipped
implementation is a JSON file store (`data/`, gitignored, seeded on first read)
with serialised writes and atomic temp-file renames. Replacing it with Prisma
means writing one class and changing one line in `lib/repository/index.ts` —
no route, action or component imports a concrete store.

### Immutability

Settings are defaults for **future** quotations only. Every stored quotation
carries its own rates on every row and is never recalculated against new
settings — an issued price must not change retroactively. Finalized quotations
refuse edits at the repository, not just in the UI.

---

## PDF output

Two independent paths, both genuinely vector — no `html2canvas`, no
screenshots, no rasterisation:

1. **Download PDF** — `@react-pdf/renderer`, drawn as PDF primitives.
2. **Print** — `/quotations/[id]/print`, through the browser's own PDF writer.

Both are asserted in the test suite rather than assumed. The generated document
is:

- **1 page**, MediaBox `841.89 × 595.28 pt` — A4 landscape
- **0 image XObjects** — nothing rasterised
- Standard-14 Helvetica — text stays selectable and searchable
- **~8 KB**

The print stylesheet sets `@page { size: A4 landscape; margin: 10mm }`, forces
Excel's fills through with `print-color-adjust: exact`, and hides all chrome via
`.print-hidden`.

> One subtlety worth keeping: `html`, `body` and `.print-root` are pinned to
> `height: auto; min-height: 0` in print media. A `100vh` minimum resolves
> against the *screen viewport* rather than the page box and ejects a blank
> second sheet — the bug this guards against.

---

## Editor

Excel-like entry over React Hook Form:

| Key | Behaviour |
| --- | --- |
| `↑` `↓` | Move between rows |
| `Enter` | Next row, same column (never submits the form) |
| `Tab` | Next cell |
| `←` `→` | Next cell — but only with the caret at the edge, so a value can still be corrected mid-digit |

Landing on a cell selects its value, which counts as being at both edges. That
is Excel's cell-selection mode, where arrows navigate rather than nudge a caret.

Totals, the sheet preview and the PDF button update on every keystroke. The
editor deliberately does **not** subscribe to its own form: the grid, the totals
strip and the preview each watch only the slice they need, so typing re-renders
one input and the figures beside it rather than the page.

---

## Deviations from the source workbook

Three, all deliberate, all reversible:

1. **Digit grouping.** The brief specifies Indian grouping (`6,07,354`); the
   workbook prints ungrouped (`607354`). Indian is the default — switch
   **Admin → Number grouping → None** to match the original exactly.
2. **The 6MM row.** The workbook leaves several of its cells blank where no
   formula was entered. The system computes every cell, so those read `0`.
3. **`QUANTITY` header.** Wraps to `QUANTIT/Y` in the original because the
   column is too narrow; here the column fits it on one line.

The `NOTE:` footer uses the brief's corrected wording (the workbook reads
"CHEACK"). It is editable per quotation and its default is set in Admin.

---

## Notes

- **Next.js 15** as specified. The scaffold produced 16; it was pinned back.
- **Auth** is a single seam — `lib/auth/current-user.ts`. Replace that one
  function with a session lookup and every audit field records real users.
- Sizes, diameter differences, GST, discount, loading, brands, locations,
  payment terms and the footer note are all editable in **Admin → Settings**.
- The green highlight is *derived*, not hardcoded: sizes priced above the base
  diameter-difference tier get the band. That reproduces the reference sheet
  (8MM and 32MM at 6500 against a 5500 base) and keeps working when the
  difference map is edited. An explicit override list is also supported.
