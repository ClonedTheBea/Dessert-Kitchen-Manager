# Sprint 2.1 — UX & Visual Redesign

Ready for owner review. Sprint 3 has not begun.

## The result

- **Home:** five task shortcuts, date/allergen attention, minimum-stock warnings, recent batches and activity, planning figures and the next shopping task.
- **Recipes:** recipe book, ingredients/packaging and suppliers in one workspace. Dedicated reading pages show yield, cost, timing, ingredients, storage and the numbered method. Illustrations stay compact and stable across versions. Editing has Recipe details, Method and Cost & pricing sections; scaling opens its controls directly. Allergen evidence and reviews remain available in secondary sections.
- **Stock:** opens on current stock. A compact purchase basket prefills known supplier pack sizes/prices, with actual receipt values still editable. Production starts with recipe, quantity and available ingredients, then requests date review. Adjustments, traceability and costs remain accessible. Shopping lists separate Needed, Available and To buy quantities. Movement history is under More.
- **Money:** the four main financial answers appear before assumptions. Ordinary scenario edits autosave; detailed breakdowns, comparisons and actual production costs remain accessible.
- **Settings & backups:** secondary navigation, preserving authentication, audit and backup access.

Adding an ingredient and its first price is one draft and one confirmation. A new supplier can be entered inline. VAT-aware cost per g/ml/each comes from the same C# decimal calculation used for recipes. Prices remain immutable quotes, separate from stock receipts. A quick price update starts with the current pack information and retains expandable history.

Ordinary catalogue/supplier/scenario edits autosave with status, retry and conflict protection. Recipe publication, price confirmation and all stock-changing actions remain explicit. No sample purchases or production were added to the owner's database.

## Actual Apiary reference and maintainable theme

Inspected local source: `C:\Users\matt9\Desktop\Website\Apiary Dev Tools\repo\src\styles\global.css` and `tool-ui.css`.

| Role | Reference adopted |
| --- | --- |
| Application shell | `#191522` |
| Sidebar | `#211a2c` |
| Plum | `#412653` |
| Pink | `#d174d2` |
| Light cards | `#f3f0f5` |
| Card text | `#292131` |
| Soft lavender | `#e4d8eb` |
| Shell secondary text | `#bcb5c8` |
| Typography | System stack, strong headings, negative heading tracking |
| Controls and shape | 44px control height, 8px controls, 11px cards |
| Focus and elevation | Pink/light-plum focus rings; restrained dark shadows |

Edit **`client/src/theme.css`** to change the palette. Brand primitives feed semantic shell, surface, text, accent, border, focus and status roles. Every application CSS colour literal is centralized there. Accessible success/warning roles extend the reference for kitchen statuses. `redesign.css` holds application layout conventions; legacy layout classes consume the same tokens. There are no Apiary runtime dependencies, logos, marketing content or navigation labels.

## Before / after task comparison

Approximate desktop navigation/action clicks from Home, with an existing supplier, recipe and suitable stock. Excludes typing, selecting field values, opening optional evidence and scrolling gestures. Confirmation is counted; closing a completed form is not. These are structural estimates from the checkpoint and current UI, not timed user-study results. Mobile adds a menu-open action when using primary navigation; Home shortcuts need none.

| Workflow | Before | After | Practical change |
| --- | ---: | ---: | --- |
| Ingredient plus initial quote | 5 | 2 | One combined form instead of separate ingredient and price forms |
| Update a supplier price | 3 | 4 | Recipes consolidation adds one submenu step from Home; still two actions from the ingredient list, with pack/price prefill |
| Open a recipe and read method | 2 | 2 | Dedicated page; compact illustration; no dialog scrolling |
| Open recipe editing | 3 | 3 | Section buttons replace scrolling through unrelated controls |
| Receive two purchased items | 5 | 3 | Direct Home shortcut, basket, explicit receipt confirmation |
| Produce four cheesecake pots | 4 | 2 | Direct Home shortcut; quantity and stock review first |
| Record a sample/spoiled pot | 4 | 3 | Current stock is the default; choose Sample / waste on its lot |
| View remaining stock | 2 | 1 | Check stock shortcut opens balances immediately |
| Start a shopping list | 3 | 2 | Home shopping task opens plans directly |
| View break-even and profitability | 1 | 1 | Four results come first; no opening/scanning assumptions required |

Date evidence, adjustments and actual transaction review still require user attention. Click reductions do not bypass those safeguards. Opening the Money comparison requires one deliberate expansion; technical inventory history also has an extra secondary step.

## Verification

- Baseline before edits: **87 backend tests and 14 browser tests passed**.
- Final backend suite: **92 passed**, including new atomic combined creation, new/existing supplier, repeated confirmation, invalid-price rollback, stale revision, supplier dependency/archive and decimal VAT-preview tests.
- Browser suite: **17 passed**, covering the existing workflows plus new navigation, combined ingredient/supplier/price creation, draft recovery, theme-variable propagation, keyboard skip link and redesigned screens.
- Browser sizes: **1440px and 390px** for redesign checks, **1280px and 390px** for the complete inventory lifecycle; existing tests also verify illustration dimensions across Versions 1, 2 and 3.
- Accessibility: axe checks using WCAG 2 A/AA, 2.1 AA and 2.2 AA tags across **20 views at both sizes**, with **zero violations** in the final run. Contrast issues found on dark-shell captions were corrected. Horizontally scrollable tables are keyboard-focusable. Focus rings, reduced-motion handling, named dialogs, save/error announcements and responsive overflow checks are retained.
- Automated acceptance receives multiple ingredients, handles a shortage/top-up, produces **four lemon cheesecake pots**, records one sample, verifies **three remaining**, checks actual batch cost/traceability, performs a stocktake and exports a shopping list. All fixtures use isolated test databases.
- Production frontend build and .NET Release publish verified. No database migration was introduced.

Automated accessibility checks and Chromium emulation are not a full WCAG certification or a real-device/screen-reader usability study. Manual checks remain below.

## Screenshots

Local evidence lives in `artifacts/sprint21-evidence/after/`. It uses synthetic test data, not the owner's kitchen records. The matching stock screenshots before redesign are in `artifacts/sprint21-evidence/before/`.

| View | Desktop | Mobile |
| --- | --- | --- |
| Home | [Screenshot](../artifacts/sprint21-evidence/after/redesign-home-1440.png) | [Screenshot](../artifacts/sprint21-evidence/after/redesign-home-390.png) |
| Recipe book | [Screenshot](../artifacts/sprint21-evidence/after/redesign-recipes-1440.png) | [Screenshot](../artifacts/sprint21-evidence/after/redesign-recipes-390.png) |
| Recipe reader | [Screenshot](../artifacts/sprint21-evidence/after/redesign-recipe-1440.png) | [Screenshot](../artifacts/sprint21-evidence/after/redesign-recipe-390.png) |
| Recipe editor | [Screenshot](../artifacts/sprint21-evidence/after/redesign-recipe-edit-1440.png) | [Screenshot](../artifacts/sprint21-evidence/after/redesign-recipe-edit-390.png) |
| Ingredient and price | [Screenshot](../artifacts/sprint21-evidence/after/redesign-ingredient-1440.png) | [Screenshot](../artifacts/sprint21-evidence/after/redesign-ingredient-390.png) |
| Purchase | [Screenshot](../artifacts/sprint21-evidence/after/redesign-purchase-1440.png) | [Screenshot](../artifacts/sprint21-evidence/after/redesign-purchase-390.png) |
| Production | [Screenshot](../artifacts/sprint21-evidence/after/redesign-production-1440.png) | [Screenshot](../artifacts/sprint21-evidence/after/redesign-production-390.png) |
| Stock | [Screenshot](../artifacts/sprint21-evidence/after/redesign-stock-1440.png) | [Screenshot](../artifacts/sprint21-evidence/after/redesign-stock-390.png) |
| Money | [Screenshot](../artifacts/sprint21-evidence/after/redesign-money-1440.png) | [Screenshot](../artifacts/sprint21-evidence/after/redesign-money-390.png) |

## Data preservation and checkpoint

- Pre-change Git tag: **`sprint-2-before-redesign`** at `bd6805d`.
- Work branch: **`codex/sprint21-redesign`**.
- Consistent SQLite backup: **`data/backups/before-sprint21-20261010-203826.db`**. SQLite integrity and foreign-key checks passed.
- Private baseline: `data/sprint21-before.json`; every row of every table was captured for comparison.
- Preserved baseline: **32 documents, 34 prices, 12 recipe versions, 1 owner, 119 audit entries, 182 dependencies, 11 drafts, 1 inventory location, 1 inventory operation, 7 lots and 7 movements**. Dietary reviews and stocktakes were empty. Four migration records remain unchanged.
- All **14 tables** compared equal to the baseline both before and after Release startup; SQLite integrity was `ok` and foreign-key violations were zero. Release-startup verification is recorded in `artifacts/sprint21-evidence/release-check.json`: existing owner configured, unauthenticated records denied (401), and served JS/CSS matched the published assets. The local release is running at `http://127.0.0.1:5080`.

Backend additions are limited to the combined draft transaction and read-only price preview. Authentication, financial modelling, recipe cost/version snapshots, FIFO, posting, stocktakes, traceability, approvals and restore behaviour retain their existing implementations.

## Owner acceptance checklist

- [ ] Sign in with your existing password. Confirm your current recipes, prices, scenarios and seven existing stock lots are present.
- [ ] Review the plum shell, light cards and pink focus states on desktop and your phone.
- [ ] Add an ingredient with a supplier and quote in one form; try creating a new supplier inline. Check VAT treatment and unit cost.
- [ ] Update a price and inspect its retained history. Confirm a published recipe's historical cost has not changed.
- [ ] Open a recipe, read its method, edit a step, leave/reopen its draft and publish deliberately. Check Versions 1–3 and their illustrations.
- [ ] Scale a recipe and review the quantities. Check sub-recipes still hide selling-price controls.
- [ ] Record a real multi-item purchase, review dates and quantities, and confirm receipt once.
- [ ] Make four pots only if production actually occurred; review available stock, dates and any optional costs, then confirm.
- [ ] Record a real sample/spoilage, inspect remaining stock and trace the finished lot to ingredients.
- [ ] Count stock at a chosen location, review discrepancies and confirm adjustments.
- [ ] Build a shopping list; check Needed, Available, To buy, estimated costs, print and CSV export.
- [ ] Open Money, read the four results, change assumptions and check autosave/recalculation. Expand comparisons and actual production costs.
- [ ] Use keyboard navigation, focus rings, horizontal table scrolling and the mobile menu. Review with your preferred screen reader/device.
- [ ] Download a backup; practise restore into a separate database path with that target stopped.

## Known limits

Existing Sprint 2 scope limits continue to apply: one owner, shared drafts with conflict protection, no offline queue, actual sales/orders/platform integration or automatic expiry evidence. No photographic upload system was added; the illustration region is isolated for a future image source. Recipes are dedicated page views within the existing single-page application, without bookmarkable recipe URLs. Wide detailed tables scroll horizontally inside their panels. Financial summaries remain estimates, not actual sales/profit. No network/IIS deployment was performed.

Please review and accept Sprint 2.1 before authorizing Sprint 3.
