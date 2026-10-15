# Sprint 3.1 — Orders, purchases and stock usability

## Delivered

- A shared category selector in Orders and Financial Overview. Categories come from saved recipe metadata, empty categories are hidden, and missing categories appear under Other. Direct search bypasses categories. Category navigation leaves the order basket intact; repeated product selection increments quantity. Existing price breakdowns and calculations are unchanged.
- Main navigation now says **Recipes & Ingredients**, with visible Recipe Book, Ingredients and Suppliers destinations. Home retains its ingredient shortcut; Purchases has a direct ingredient/supplier shortcut.
- Structured date types and review sources, with Product Checked selected initially but review always requiring an explicit checkbox. Other needs notes. Apiary Shelf-Life is restricted to prepared products/components and requires a documented procedure/record reference. No duration is inferred.
- Optional date review during receipt. Unchecked lots remain unavailable; missing dates require individual attention. No-date reviews require a recorded explanation of why a date is not required.
- A purchased-stock selection list and individual-lot checkboxes. Bulk confirmation displays dates, sources and exclusions. The server rechecks eligibility and unchanged evidence, then atomically records a separate immutable review operation and audit entry for each lot. Retries do not duplicate reviews. Bulk confirmation never changes dates.
- Supplier-filtered ingredient search, with an explicit one-off path to an existing ingredient or new ingredient. New ingredients receive a real stock identity and units through the existing creation workflow. Unverified allergen information remains flagged. Actual receipt prices do not modify quotations; adding a regular quote remains an explicit separate choice.
- Successful receipts refresh stock and close the panel after server confirmation. Errors retain data. Cancel, the close button and Escape share discard confirmation for changed unconfirmed drafts. Discard retains an audit record, rejects stale saves, and starts the next purchase with current defaults. Autosaved drafts survive a reload. Receipt retries retain the same operation identity. Focus returns to the purchase entry button.

## Preservation

Before implementation: Git tag `before-sprint31-20261015` at `de1467e`; SQLite backup `data/backups/before-sprint31-20261015.db`, verified with `PRAGMA integrity_check`.

The implementation adds optional JSON fields, with no SQL migration. Existing recipes, versions, prices, stock movements, review operations, orders, refunds, imports, payouts, settings and scenarios remain in their original tables. All 20 live database table fingerprints were compared with the pre-sprint snapshot and matched. Browser tests use isolated temporary databases. A backend test opens a copy of the current populated backup, exercises stock and sales reads, and compares every table fingerprint.

## Validation

- Frontend TypeScript/Vite build: passed.
- Backend tests: 152 passed in Debug; 152 passed in Release. Both populated-backup checks were enabled, covering the earlier schema migration and current-data preservation.
- Browser suite: all 40 passed, including five new Sprint 3.1 checks covering category/basket flows, supplier filtering and new ingredient identity, receipt failure/retry, reviewed versus unreviewed lots, bulk audit history, cancellation and desktop/mobile layouts. Existing recipe-version illustration and allergen checks also pass.
- Release publish: `artifacts/sprint31-release`. Because the running local server locks the usual Release output, Release tests/publish used `--artifacts-path artifacts/sprint31-build`.
- Published Release smoke: root page, authentication setup endpoint and both static assets returned successfully on a separate loopback port and isolated database; the smoke server was stopped afterwards.
- Desktop and mobile screenshots were inspected; date selectors were widened to display the review source clearly.

To load this version, close the running launcher window and reopen `Start Kitchen.cmd`. The existing running server has been left in place.

## Screenshots

Synthetic test data only; 1440px desktop and 390px mobile.

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Categories | [Desktop](../artifacts/sprint31/categories-1440.png) | [Mobile](../artifacts/sprint31/categories-390.png) |
| Basket across categories | [Desktop](../artifacts/sprint31/basket-1440.png) | [Mobile](../artifacts/sprint31/basket-390.png) |
| Financial Overview | [Desktop](../artifacts/sprint31/money-1440.png) | [Mobile](../artifacts/sprint31/money-390.png) |
| Purchase date reviews | [Desktop](../artifacts/sprint31/purchase-1440.png) | [Mobile](../artifacts/sprint31/purchase-390.png) |
| Date controls | [Desktop](../artifacts/sprint31/purchase-date-1440.png) | [Mobile](../artifacts/sprint31/purchase-date-390.png) |
| Bulk confirmation | [Desktop](../artifacts/sprint31/bulk-1440.png) | [Mobile](../artifacts/sprint31/bulk-390.png) |

## Manual acceptance checklist

- [ ] Launch with `Start Kitchen.cmd`; check the four main navigation destinations and the Recipe Book / Ingredients / Suppliers controls.
- [ ] New Order → Cheesecakes → add Lemon Cheesecake → Back to Categories → Brownies → add a brownie twice. Check both products remain and the brownie quantity is two. Search another product directly.
- [ ] Money → Financial Overview → Brownies → product → Price Breakdown. Check the existing chart and financial details.
- [ ] Record shopping with your supplier. Check supplier-only search and Add an item not listed; map an existing ingredient or create one. Confirm pack quantity, unit, actual price and notes. Existing quotations should stay unchanged.
- [ ] Review a dated item during receipt using Product Checked; leave another unchecked. Confirm receipt closes once, updates stock and shows success.
- [ ] Open another purchase, edit it and Cancel. Decline discard to keep editing; accept discard to close and clear the draft. Reload a retained draft to verify autosave.
- [ ] Stock on Hand → Review purchased stock dates together. Select dated lots and one incomplete/expired lot. Check the confirmation lists exclusions; confirm eligible lots and inspect individual date-review history.
- [ ] Open an individual Review dates dialog. Check the default source, Other notes requirement, explicit review checkbox, and recorded date. For a prepared component, use Apiary Shelf-Life only with its approved procedure reference.
- [ ] Confirm that an expired lot stays unavailable, a required missing date cannot be approved, and a recorded date cannot be extended or removed.
- [ ] Repeat key tasks on mobile; test keyboard navigation, Escape, Cancel and focus after receipt.

## Limits and deliberate safeguards

- Existing legacy reviews remain readable. Older unreviewed lots without structured date type/source need one individual review before bulk use.
- Bulk review requires a recorded date and complete source evidence. No-date exceptions, prepared products and incomplete evidence require individual review.
- Best-before is now labelled separately, but this sprint retains the application's conservative availability restriction once any recorded date has passed. It does not automatically release stock after a best-before date.
- An Apiary procedure reference is recorded evidence supplied by the operator, not an approval-document repository or an automated safety certification. Allergen verification remains a separate existing workflow.
- Routine date review cannot extend or remove an existing recorded date. Incorrect dates require investigation rather than a bulk overwrite.
- Search results show up to 12 matches at a time; type more of the name to narrow the list.
- A newly created ingredient remains in the ingredient catalogue even if its purchase draft is subsequently discarded. Cancelling a receipt does not delete catalogue records.

Sprint 4 has not been started.

## Orders category compatibility fix

Orders now resolves category metadata from the same saved recipe state as Financial Overview. An older running sales API omitting the category field therefore no longer groups every product under Other. Sales products, channel prices and basket logic remain unchanged. The frontend build and eight focused browser checks passed, including simulated older API responses at 1440px and 390px. Restart the launcher after backend updates and refresh the browser.
