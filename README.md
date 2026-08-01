# Steel Quotation ERP — Discount / CD

A role-based, multi-branch ERP for steel trading, built around the existing
Discount/CD quotation. The quotation document itself is **unchanged**: the same
pricing engine, the same cell-for-cell facsimile of the workbook, the same
vector A4-landscape PDF. Everything else — branches, users, customers, the cash
ledger, approvals, reports and the audit trail — is built around it.

```bash
npm install
cp .env.example .env       # then set DB_URL and AUTH_SECRET
npm run db:deploy          # apply migrations
npm run db:seed            # organisation + reference quotation
npm run dev                # http://localhost:3000
```

The seed builds the organisation from the brief and prints its credentials:

| Username | Role | Scope |
| --- | --- | --- |
| `superadmin` | Super Admin | Everything |
| `mangalore.admin` | Branch Admin | Mangalore |
| `mangalore.manager1` / `…2` | Manager | Own records, Mangalore |
| `maharashtra.admin` | Branch Admin | Maharashtra |
| `maharashtra.manager1` / `…2` | Manager | Own records, Maharashtra |

Password for all of them is `ChangeMe123` (override with `SEED_PASSWORD`).
**Rotate these before the system carries real data.**

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Engine, PDF and RBAC suite (50 tests) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed the organisation (idempotent) |
| `npm run db:studio` | Browse the database |

---

## Access control

Three roles, enforced **on the server only**. Nothing anywhere reads a role from
the client: the session cookie carries a session id, the user record is loaded
from the database on every request, and every page and action passes through
`modules/auth/guard.ts`.

| | Super Admin | Branch Admin | Manager |
| --- | --- | --- | --- |
| Scope | All branches | Own branch | Own records |
| Branches | Create / edit / archive | View + edit own | — |
| Users | All, any role | Own branch, managers only | — |
| Quotations | All, approve, delete | Branch, approve, delete | Own, create/edit |
| Cash ledger | All, approve | Branch, approve | Own, create |
| Reports | All | Branch | Own |
| Master settings | ✓ | — | — |
| Audit log | ✓ | — | — |

Permissions answer *"may this user do X?"*; **scope** answers *"over which
rows?"* — and scope is the half that actually enforces tenancy
(`modules/permissions/scope.ts`). Two decisions there carry most of the weight:

- **The "no access" scope returns an impossible filter, not `{}`.** An empty
  `where` in Prisma matches *every* row, so a missed case would leak the whole
  table rather than nothing. There is a test for exactly this.
- **`resolveWriteBranch` ignores any `branchId` in the request** for non-super
  users and takes it from the session instead. That is what stops a manager
  re-pointing a create at another branch by editing the form post.

A Super Admin short-circuits every check, including their own denial list — the
brief says the role "cannot be restricted", and honouring a mis-set denial there
could lock the organisation out with no way back in.

### Verified end to end

Signed in as each role in a real browser against the seeded data:

```
SUPER ADMIN nav : Dashboard, Quotations, Customers, Cash ledger, Reports,
                  Branches, Users, Master settings, Audit log
MNG MANAGER1    : sees own quotation                        VISIBLE
MNG MANAGER2    : same branch, not the owner   0 rows       404 BLOCKED
MAH ADMIN       : other branch                 0 rows       404 BLOCKED
                  …its /print route                         404 BLOCKED
                  /admin/audit, /admin/settings             FORBIDDEN
MNG MANAGER1    : /admin/users                              FORBIDDEN
```

Out-of-scope ids return 404 rather than 403 — a 403 would confirm that another
branch's reference exists.

---

## Organisation model

```
Branch (the tenant)
  └── Users            SUPER_ADMIN | BRANCH_ADMIN | MANAGER
  └── Customers
  └── Quotations ── QuotationRows
  └── Cash ledger entries
  └── Audit log, Notifications, Settings
```

Branches are data, not code — add Delhi, Goa or Hyderabad in the UI and every
scope, report and reference series adapts. Every table carries `createdAt`,
`updatedAt`, `deletedAt`, `createdById`, `updatedById`; **nothing is ever
physically deleted.**

### Quotation workflow

```
DRAFT ──► PENDING_APPROVAL ──► APPROVED ──► COMPLETED
  │              │   └────────► REJECTED ──┐
  └──────────────┴──────────────────────────┴──► CANCELLED
```

The legal moves live in one transition table in `quotation-service.ts`, and the
UI only offers moves that table permits — so the buttons can never suggest
something the server will refuse. Approved quotations are immutable: they are a
record of a commitment, and the edit route redirects rather than rendering a
form that cannot save.

### Cash ledger

Money is stored as `Decimal` and summed in the database, never accumulated
through JavaScript floats. Only `RECEIVED` and `CLEARED` entries move the
balance — `PENDING` is an expectation and `CANCELLED`/`RETURNED` never landed.
A date-filtered view still shows a truthful opening balance, computed from every
settled entry before the window. Cleared entries cannot be deleted; the
correction is a reversing entry, so the trail survives.

Entries created by someone without approval rights always start `PENDING`,
whatever the form claims.

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

Feature modules own their own schema, service and actions. Nothing reaches
across into another module's internals.

```
prisma/schema.prisma          Branch · User · Customer · Quotation · Ledger
                              · AuditLog · Notification · Session · Sequence
src/
  modules/                    ── feature-sliced ──────────────────────────
    auth/         password hashing, DB-backed sessions, guards
    permissions/  the catalogue, the role matrix, scope resolution
    branches/  users/  customers/  quotations/  ledger/
    dashboard/  reports/  audit/  notifications/  settings/
    shared/       ActionResult, reference-number allocation
  lib/
    quotation-engine/         Pure functions. No React, no I/O. UNCHANGED.
      calculateRow · calculateGST · calculateDiscount
      calculateTotals · calculateQuotation · money
    template/sheet-template.ts  Geometry + colours, in millimetres. UNCHANGED.
    pdf/                        Vector PDF (@react-pdf/renderer). UNCHANGED.
    database/prisma.ts          Pooled client, cached across dev reloads
    validation/  format/
  components/
    quotation/QuotationSheet.tsx   the facsimile. UNCHANGED.
    quotation/QuotationEditor.tsx  the form
    shared/  layout/  admin/  …
  styles/sheet.css               screen + print, one stylesheet. UNCHANGED.
  middleware.ts                  fast redirect for unauthenticated navigation
  app/
    login/  forbidden/
    (shell)/                     authenticated chrome
    (print)/quotations/[id]/print  bare print route (still authorised)
    api/reports/export             CSV download
```

Each module is three files: a Zod **schema**, a **service** that owns the
business rules and the database, and thin **actions** that authorise, re-parse
the payload and delegate. Every server action re-validates with the same schema
the form uses — an action is a public HTTP endpoint, so client-side validation
is a convenience and never the enforcement point.

**The engine never touches the UI, and the UI never does arithmetic.** The sheet
component receives values that are already resolved; the editor calls the same
engine the server does.

### One source of geometry

`sheet-template.ts` holds the column widths, row heights, fills and font sizes
in **millimetres against an A4 landscape page**. The HTML sheet consumes them as
CSS `mm`; the PDF converts them to points. Preview, print and download cannot
drift apart, because there is only one set of numbers.

Verified: the sheet renders at exactly **1046.92 px = 277 mm**, the printable
width of A4 landscape at 10 mm margins.

### Persistence

PostgreSQL via Prisma 7 with the `pg` driver adapter. The runtime client uses
Neon's **pooled** endpoint; migrations use the **direct** one, because they take
advisory locks that pgBouncer does not support. Both URLs live in `.env`, and
`prisma.config.ts` wires the migration one up.

The quotation service maps database rows to the same `Quotation` domain type the
engine and the sheet always consumed — which is exactly why moving from the old
JSON file store to Postgres did not require a single change to the engine, the
sheet or the PDF renderer. `quotation-mapper.ts` is that seam.

Reference numbers (`MNG/QT/2026/0001`) are allocated with a single atomic
`INSERT … ON CONFLICT DO UPDATE … RETURNING`. Read-then-write in application
code would let two concurrent saves mint the same reference; letting Postgres do
the increment removes the race without a lock or a retry loop.

### Immutability and the audit trail

Settings are defaults for **future** quotations only. Every stored quotation
carries its own rates on every row and is never recalculated against new
settings — an issued price must not change retroactively. The header is a
*snapshot* too: renaming a customer never rewrites a document already issued to
them. Approved quotations refuse edits in the service, not just in the UI.

Every mutation writes an audit row: who, what, when, from which IP, and a diff
of the fields that actually changed. The log is append-only — there is no update
or delete path for it anywhere in the codebase. Audit writes are best-effort so
a logging failure can never roll back the business operation the user asked for.

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

- **Next.js 15** as specified, with Prisma 7 + PostgreSQL (Neon).
- **Auth** is a signed session cookie carrying a session *id*, not claims. The
  user is re-read from the database each request, so disabling an account,
  changing a role or resetting a password takes effect on the very next request
  rather than whenever a stale token happens to expire. Disable, role change,
  branch move and password reset all revoke live sessions.
- **Login failures** report one generic message whatever the cause, and hash a
  placeholder for unknown usernames so timing does not turn the form into a
  username oracle.
- **CSV export** prefixes any value starting with `=`, `+`, `-` or `@` with an
  apostrophe, so a customer named `=cmd|…` cannot become a live formula when the
  file is opened in Excel.
- **Escalation is blocked both ways**: nobody may create or edit a user at or
  above their own role, and the last active Super Admin cannot be demoted,
  disabled or deleted.
- Sizes, diameter differences, GST, discount, loading, brands, locations,
  payment terms and the footer note remain editable in **Master settings**.
- The green highlight is still *derived* from the diameter-difference tier
  rather than hardcoded, so it keeps working when the difference map is edited.

## Still to build

Honest about scope: the brief lists these under future scalability and they are
**not** implemented — inventory, purchase/sales orders, invoices, stock
transfers, warehouse management and CRM. The schema and module layout leave room
for them (branch-scoped tables, soft deletes, the audit trail and the service
layer all generalise), but no code exists for them yet. Report export is CSV
only; the brief also mentions PDF and Excel export for reports.
