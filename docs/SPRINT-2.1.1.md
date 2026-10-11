# Sprint 2.1.1 — Final usability polish

Completed 11 October 2026. The Sprint 2.1 design tokens, plum shell, light cards, four main sections and application architecture are retained. Sprint 3 has not begun.

## Before and after

| Area | Before | After |
| --- | --- | --- |
| Stock | Individual lots, costs and five actions competing on each card | One row per ingredient/product, usable quantity, location and warnings; one Manage action exposes lots, costs, transfers, date reviews and movement/adjustment history |
| Production | Recipe version, allocations and adjustments prominent | Recipe and quantity first; latest published version selected for a new recipe choice; stock review next; versions, FIFO and adjustments secondary |
| Completion | Remained in production form | Confirmation opens Finished Products at the output location with the quantity recorded |
| Shortage | Technical shortage feedback | Named missing ingredients and quantities, with purchase, stock adjustment and shopping-list routes; Return to production restores the saved batch |
| Household stock | Needed a purchase/production trail | Add Existing Stock records cupboard ingredients or already-prepared products, optional dates, source, notes and known/estimated/unknown total cost |
| Ingredient pricing | Supplier pricing easily confused with stock receipt | Set Supplier Price / Update Price, supplier and pack information, useful-unit pricing, and Record Purchase shortcut using the latest confirmed price |
| Numbers and planner | Excess decimal places and some implicit periods | Ordinary GBP totals use two decimals; useful prices such as £1.63/kg and 16.3p/100g; readable quantities; planner order targets explicitly say orders / month |

## Data and accounting safeguards

Pre-change Git checkpoint: `d1a805b`, tagged `sprint-2.1-before-polish`. Verified SQLite backup: `data/backups/before-sprint211-20261011-213805.db`.

After implementation and tests, every row in all 14 existing tables matches the saved baseline and backup. Integrity check returns `ok`; foreign-key check reports no errors. Preserved: 33 documents, 36 prices, 12 recipe versions, 122 audit rows, 13 working drafts, 7 lots and 7 movements, plus all other records and dependencies. Browser and backend tests use separate databases. No new SQL migration or live-data rewrite was required.

Existing-stock receipts are immutable, authenticated inventory transactions with revision-checked draft confirmation and duplicate protection. They create a real opening receipt and audit record, without creating supplier purchases or consuming recipe ingredients. Historical preparation records an optional actual preparation date separately from receipt/recording time. FIFO allocation uses the existing recorded receipt order; earlier stock history is not invented.

Unknown cost is stored as null, not zero. Known and estimated totals retain their status through FIFO allocations and subsequent production. A batch using any unknown-cost input has unknown material, batch and unit valuation; estimates remain marked estimated. Old lots retain their known costs. C# decimal arithmetic and existing monetary output rounding are preserved; new display formatting does not round inputs or intermediate calculations. Planning recipe estimates remain separate from actual stock valuation.

Unreviewed or expired stock stays unavailable. Date review evidence remains required when marking dates reviewed. Historical products have no assumed recipe version, ingredient-lot trace or allergen approval. Existing household ingredients also retain an unverified-source warning. Negative stock, cross-pool transfers, stale confirmations and invalid reversals remain guarded.

## Validation

- `dotnet test tests --no-restore`: **101 passed** (all previous 92 plus 9 new cases).
- `npx playwright test`: **20 passed** (all previous 17 plus 3 new workflows).
- `npm run build`: TypeScript and production Vite build passed.
- `dotnet publish server -c Release --no-restore -o artifacts/sprint211`: passed.
- Desktop (1440px) and mobile (390px) workflows passed, including WCAG-tagged axe checks and horizontal overflow assertions on the affected screens. Selected stock, production, pricing and planner screenshots were visually reviewed.
- Existing recipe category illustration regression tests still cover versions 1, 2 and 3.
- New backend coverage includes receipt provenance, nullable/estimated FIFO costs, historical products, sampling, stock safety, audit/dependencies, backup/restore, authentication, stale drafts and duplicate confirmation.
- New browser coverage exercises household flour, historical brownies/cheesecakes, one brownie consumed, a four-pot batch, all three shortage recovery routes, saved production drafts, finished stock, useful-unit pricing and actual purchase confirmation.

Local screenshots and verification metadata are saved in `artifacts/sprint211-evidence/`. Earlier screenshots remain in `artifacts/sprint21-evidence/after/` for comparison. These ignored folders contain local evidence, not application source.

A separate published-server launch smoke check was blocked by automatic approval review without a specific reason. Release compilation/publishing and the isolated browser-test server are verified; that separate release launch is not. No local server is left listening on ports 5080, 5081 or 5082.

## Manual acceptance checklist

Use a Home testing location for deliberate test entries; confirmations really update stock. These steps have automated coverage, but remain useful for your own acceptance review.

- [ ] Start `Start Kitchen.cmd`, unlock the kitchen, and use both desktop and a narrow/mobile viewport.
- [ ] Add an ingredient and supplier price. Check pack information and useful-unit pricing; verify that price publication alone does not add stock.
- [ ] Choose Record Purchase, review the prefilled confirmed price, and explicitly confirm the receipt.
- [ ] Add 500g of cupboard flour using Add Existing Stock, with source and date evidence; leave unknown cost blank. Check opening-stock provenance and no invented purchase.
- [ ] Add four already-prepared cheesecake pots and nine brownies. Record actual preparation/use-by dates only when known, and inspect the historical preparation trace.
- [ ] Record one brownie as a quality-control sample. Check eight remain and inspect its movement history through Manage.
- [ ] Start a four-pot recipe batch. Check latest version defaults, and expand version selection only when needed.
- [ ] Encounter a shortage; open a purchase, stock management or shopping list, then Return to production. Check the same recipe and four portions remain.
- [ ] With sufficient reviewed ingredients, confirm production. Check the completed four-pot batch appears immediately in Finished Products and its ingredients were consumed once.
- [ ] Open Manage to inspect individual lots, FIFO trace, date review, movement history and source operations; verify expired/unreviewed quantities remain clearly held.
- [ ] Open Money and read break-even orders per evening/month and monthly profit. Expand assumptions or comparisons when needed.
- [ ] Close the launcher window and confirm the local site stops serving; restart it to resume saved data.

## Limits

- Unknown valuation intentionally prevents a complete actual-cost total. Estimated values are not actual purchase costs. Stock value is not a profit or cash-flow report.
- The existing-stock UI deliberately does not guess the recipe version or composition of historical products. Such products can be counted/consumed, but are not automatically eligible as version-matched prepared subcomponents for production.
- Existing-stock receipts are immutable; corrections use the existing adjustment/reversal mechanisms and their dependency guards. A consumed receipt cannot simply be deleted or reversed into negative stock.
- The Return to production banner lasts for the current page session. After a reload, open Production → Make a batch / resume draft to recover the persisted draft.
- Shopping lists remain editable saved plans, not reservations; final production rechecks current stock. Supplier-price shortcuts prefill the latest confirmed price, not unpublished price edits.
- Date review records the owner's evidence; the application does not infer safe shelf life or certify historical allergens.
- Automated browser checks use Chromium at desktop/mobile widths, not physical mobile devices. The separate Release server launch check remains unverified as described above.

Run locally by double-clicking `Start Kitchen.cmd`. It builds and serves the current app at http://127.0.0.1:5080 while its window is active. Closing that window stops its server. Your data stays in `data/kitchen.db`.
