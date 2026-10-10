# Sprint 2: Inventory and stock management

Sprint 2 is implemented for owner acceptance. Sprint 1.1.1 was preserved at commit `861edc1`, tagged **`sprint-1.1.1-accepted`**. Work is on `codex/sprint2-inventory`. Sprint 3 has not begun.

Open **http://127.0.0.1:5080** with your existing owner login, then choose **Inventory**. The published Release build is in `artifacts/sprint2`; the existing Start Kitchen shortcut still builds and starts the application normally.

## What is available

- **Overview:** valuation, minimum-stock alerts, expiry/date-review attention, recent activity, prepared/finished stock availability and waste value for the selected location.
- **Purchases:** multiple ingredient/packaging lines, existing suppliers, actual receipt prices, optional quote prefill, pack/case quantities, compatible units, VAT treatment, supplier batch references, dates, location and notes. Drafts autosave; an explicit receipt confirmation changes stock once.
- **Stock on Hand:** physical and usable quantities, lot value, original receipt quantity, expiry status, minimum levels, search, sorting, attention filter, transfers and explained adjustments. Existing ingredients are reused, including those with no stock.
- **Production:** select a published version, scale planned output, inspect nested ingredient/packaging requirements and shortages, choose prepared components, adjust actual usage/yield with an explanation, record labour/other costs and producer, then explicitly confirm completed production. Made-ahead production creates a lot; made-to-order production records consumption and cost without creating finished stock.
- **Finished Products:** recipe version, batch, produced/remaining/usable quantities, location, recorded use-by, actual unit cost and remaining value. Trace batches back through prepared components to purchase lots and the supplier details captured at receipt.
- **Stocktake:** location/category snapshots, full or partial physical counts, discrepancy explanations, review before posting, resumable drafts and previous counts. Movements affecting a counted lot after the snapshot block finalisation atomically; start a fresh count for affected lots.
- **Waste:** expired, damaged, spoiled, production error, quality-control samples, personal/staff consumption and explained other waste. Costs are reported by reason, separately from future sales. Reversed waste is excluded from totals.
- **Shopping Lists:** combine planned recipes and nested requirements, compare usable stock, round shortages to quoted packs, edit purchase pack counts, retain notes, print and export CSV. Planning never reserves or deducts stock.
- **Movement History:** quantity, unit, value, event date, recorded timestamp, actor, location, reason and source operation. Open an operation to inspect its stored inputs/result or record an explained reversal. Date reviews have their own retained history.

Locations can be added for a fridge, freezer, dry storage, finished products or another kitchen. Each belongs to **testing** or **commercial** stock. Transfers and production cannot cross those pools. The initial location is Home Test Kitchen; no opening quantities are invented.

## Migration and preservation

`server/Migrations/004_inventory.sql` adds five tables:

| Table | Purpose |
|---|---|
| `inventory_locations` | Named locations and testing/commercial pool |
| `inventory_operations` | Immutable requests, idempotency hashes, results and reversal references; includes date-review history |
| `inventory_lots` | Original purchase/production lots, unit costs and source snapshots |
| `inventory_movements` | Append-only signed stock deltas; the stock source of truth |
| `inventory_stocktakes` | Immutable expected-quantity and last-movement snapshots |

Foreign keys protect ingredient, recipe-version, location and operation references. Triggers prohibit updating/deleting lots, operations, movements and stocktake snapshots. Lot dependencies and purchase supplier references prevent deleting records needed for historical traceability. Inventory drafts use the existing revision-controlled `working_drafts` table; purchase and recipe-plan references are protected while drafting.

The migration is additive. It does not reprice recipes, change scenarios, rewrite ingredient information or seed demonstration stock. Backups and restore support schemas 1–4; older backups migrate on startup. Inventory, snapshots, date reviews, drafts, posting results and the existing owner account are included in SQLite backups.

The live database was upgraded in place and compared with a pre-sprint baseline. **Every original row was preserved exactly**, including 29 documents, 22 prices, 12 recipe versions, 1 owner, 62 audit entries, 150 dependency rows and the existing working draft. SQLite integrity and foreign-key checks passed. The owner account remains configured. Live inventory has **zero lots, zero operations and zero movements** immediately after upgrade.

Retained backups:

- `data/backups/before-sprint2-20261010-150928.db`
- `data/backups/before-migration-4-20261010-143402680.db` (UTC timestamp)
- All earlier backups remain in place.

Do not restore an older database over a running app. The existing offline restore command and process lock remain in force. A downgrade requires the pre-sprint backup, which would omit any subsequently entered inventory; keep a current backup too.

## Valuation, quantities and corrections

**FIFO by receipt-entry time** selects usable lots at the chosen location. Backdating a receipt does not rearrange earlier cost allocations. C# `decimal` handles quantities, conversions, allocation and valuation. Unit costs retain full decimal precision; monetary displays round at the boundary. Summed dashboard/waste monetary totals are calculated on the server.

Purchase valuation includes unrecoverable VAT and excludes explicitly recoverable VAT. A case is an entered number of inner packs; the price and size fields refer to one inner pack. g/kg and ml/l convert within their dimensions; individual packaging uses `each`. There is no guessed mass/volume conversion. Prepared components use their recipe's declared supported output unit.

Production preserves selected recipe versions, actual consumed lot quantities/costs, actual yield, labour/other costs and the resulting batch/unit cost. Published estimates remain separate. A prepared component must match the version pinned in the parent recipe's published cost snapshot. Consuming it deducts prepared stock only; producing an inline component deducts its ingredients. The API also supports explicitly identifying a source lot in actual usage; the normal UI uses FIFO.

The financial planner offers a batch comparison alongside the current scenario variable-cost assumption. A batch unit and a customer order can represent different quantities and cost inclusions. No scenario is overwritten automatically.

Expired and unreviewed stock remains in physical stock and valuation until disposed of; it is excluded from usable stock. A reviewed lot without a use-by requires explicit evidence. No recipe shelf-life number is turned into a safe date. Date corrections append review operations, retaining original receipt dates and all earlier reviews. Existing allergen approvals remain independent; ingredient/source changes flag affected lots and downstream batches. Receipt snapshots retain supplier and ingredient/allergen provenance. A batch is never automatically certified allergy-safe or suitable for a dietary claim.

Receipts, production, waste, transfers, adjustments and counts are transactional. A stable operation ID and payload hash prevent duplicate posting, including retries after a lost acknowledgement. Reusing an ID for different details is rejected. Draft revision conflicts protect concurrent edits. Negative stock is rejected; no hidden override is provided.

Reversals append inverse movements at the original lot costs. They cannot remove quantities that have already been consumed or moved away. Reverse dependent usage first, or enter an appropriate explained correction. A reversal cannot itself be reversed. Correct a date review by recording another review. Physical-count gains and manual adjustments retain the chosen lot's original cost and provenance.

## Verification performed

- **87 backend tests passed:** all 63 prior tests plus 24 inventory test cases covering purchases, conversions, cases, VAT, partial packs/FIFO, immutable costs, scaling/nesting, waste, actual usage/yield, prepared-component double-deduction prevention, made-to-order, negative balances, expiry/date review, transfers/pools, reversals, stocktake reconciliation/concurrency, shopping/pack rounding, transaction rollback, duplicate requests, authenticated draft confirmation, populated schema-3 migration and backup/restore.
- **14 browser workflows passed:** all 11 previous workflows plus desktop and mobile purchase-to-production acceptance workflows and draft-resume/duplicate-confirmation coverage. The existing illustration regression checks Versions 1, 2 and 3 at desktop/mobile sizes.
- After final location, provenance, totals and navigation adjustments, **all three inventory browser workflows passed again**, including immediate tab navigation flushing shopping notes.
- TypeScript and Vite production build passed. `dotnet publish server -c Release -o artifacts/sprint2 --no-restore` passed.
- Desktop 1280px and mobile 390px inventory screenshots were inspected. No document-width overflow; mobile count/action controls and locally scrollable tables remain usable.
- Real database baseline comparison, integrity/foreign-key checks and configured-account release smoke check passed. Demonstration records were confined to isolated test databases.

## Isolated acceptance demonstration

The browser acceptance workflow was executed at both desktop and mobile widths. Each run used its own named test location inside Playwright's separate database on port 5081, not the owner's database on port 5080. The backend acceptance test also backed up and restored its independent database.

| Step | Observed result |
|---|---|
| Receive 280g cream cheese for £3.25 and 300ml cream for £1.70 | Correct lot quantities and receipt costs retained |
| Receive butter and other required items | 250g butter for £1.85; biscuits, sugar, lemon juice and pots recorded as additional illustrative purchases |
| Select existing Lemon cheesecake pot Version 1, planned yield 4 | Resolves 120g biscuits, 48g butter, 300g cheese, 160ml cream, 60g sugar, 40ml lemon juice and 4 pots |
| Check initial shortage | **20g cream cheese short**; 280g is insufficient for this existing recipe |
| Receive another 280g cheese pack | Shortage cleared; actual FIFO consumption spans the two cheese lots |
| Produce four | Each required ingredient/packaging quantity deducted once; 4 finished pots created |
| Record one quality-control sample | 3 finished pots remain; sample cost recorded separately |
| Count butter | Expected 202g, physically counted 200g; explained 2g handling loss posted as a stocktake correction |
| Plan next four pots | Cheese required 300g, usable 260g, shortfall 40g; one 280g quoted pack suggested |
| Inspect costs/history | Production cost and recipe version remain unchanged; lot movements reconcile |
| Back up and restore isolated data | Operations and movements match exactly; 3 finished pots remain after restoration |

For the browser run, the additional biscuits/sugar/lemon/pot packs were each priced illustratively at £1 for twice the required amount. This produces an actual batch cost of **£6.74**, displayed unit cost **£1.69**, and remaining three-pot value **£5.06**. These are test results, not your actual product costs. No stock was added to your live database.

## Owner acceptance checklist

- [ ] Sign in with the existing password; inspect existing recipes, historical prices, methods, approvals and saved scenarios.
- [ ] Open Inventory and confirm Home Test Kitchen begins empty. Existing ingredients should be selectable without re-entry.
- [ ] Enter a real purchase, verify the unit/pack/price basis, save a draft and reopen it. Confirm the receipt once and inspect the resulting lot.
- [ ] Preview a recipe batch, inspect shortages and FIFO allocations, review dates/evidence, and confirm only production that actually occurred.
- [ ] Inspect the finished lot, its source trace, actual cost and any allergen/date attention flags.
- [ ] Record an appropriate sample or waste event and check remaining quantity and cost.
- [ ] Complete a partial count with an explained discrepancy; review the resulting movement.
- [ ] Generate and edit a shopping list, navigate away and return, then print/export it.
- [ ] Compare a production batch in Financial planner and confirm the scenario is unchanged.
- [ ] Download a current backup and practise restoration to a separate database path with the target app stopped.

## Limitations and deferred work

- No customer orders, sales deduction, platform integrations, reservations, purchase orders or tax/accounting reports. Those belong to later accepted sprints.
- One owner and one shared resumable draft per purchase/production/action type and shopping list; one draft per stocktake snapshot. Concurrent edits are rejected rather than automatically merged. No offline queue.
- A production run consumes from one location. Transfer ingredients into the preparation location first; output can go to another location in the same stock pool. The UI allocates FIFO rather than offering arbitrary lot picking.
- Shopping uses the latest effective supplier quote, not a cheapest-price optimiser or configurable preferred-supplier policy. No quote means a visible missing estimate. Prepared-component selection is available in production; shopping UI plans inline ingredient needs. The shopping API also accepts held-component choices.
- Reviewed shelf-life evidence and corrections are manual. No reusable automatic shelf-life rule engine, temperature log, barcode scan, uploaded evidence or independent food-safety certification is provided.
- Minimum-stock levels currently belong to ingredients/packaging, not separate per-location or finished-product reorder policies. Locations cannot yet be renamed/archived through the UI.
- Whole operation reversal is supported; correct one purchase line by reversing/re-entering an unused receipt or making a documented adjustment. No supplier returns/credit-note accounting or landed-cost allocation.
- Full-decimal unit costing can leave sub-penny mathematical residuals; monetary presentation rounds to pennies. Physical valuation is an inventory management view, not statutory accounting.
- Views load the full ledger for this single-owner kitchen; pagination and larger multi-user concurrency are future work. IIS/network deployment was not tested.

Sprint 3 requires explicit owner acceptance before work starts.
