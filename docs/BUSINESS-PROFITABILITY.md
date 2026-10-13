# Business settings and product profitability — acceptance handover

Implemented 13 October 2026 as an integrated pre–Sprint 3 improvement. Sprint 3 has not started and requires acceptance first.

## Where to find it

- **Settings & backups → Business settings**, also available in **Money → Business settings**: one shared configuration with autosave and effective-date revision history.
- **Money → Product profitability**: searchable sellable recipes, channel comparisons, cost breakdowns, whole-business forecasts and recorded batch costs.
- Select a product, then **Configure product** for live selling prices, monthly volumes, VAT, equipment use and direct labour assumptions. These edits autosave to a retained business-settings revision; they do not rewrite a recipe.
- **Try pricing simulator** changes only an in-memory forecast. Save a pricing scenario to retain an immutable input/result snapshot; compare it with current simulation results or load its assumptions for a new calculation.
- **Money → Glossary**: searchable definitions/examples. The same definitions appear in keyboard-accessible tooltips in the catalogue, settings and planner; Escape dismisses a tooltip.
- The existing financial planner and its scenarios remain available. **Use these assumptions in the financial planner** creates a new independent scenario from the configured business forecast; it never overwrites an existing scenario.

The four primary navigation sections, Apiary tokens, plum shell, light cards, recipe/stock workflows and explicit stock confirmations remain intact.

## Business configuration

Tariffs support electricity/gas in p/kWh, water in p/m³ and daily standing charges in p/day, with explicit VAT-inclusive/exclusive amounts. Equipment has a name, fuel, kW rating and average load percentage. Product plans supply minutes per published batch and water litres per batch.

Named expenses cover rent, business rates, insurance, marketing, subscriptions, utilities and other costs. Choose monthly or annual for fixed costs, or per sold unit for variable expenses. Mark an expense **Already attributed directly** to exclude it from additional forecast costs. This prevents deliberately identified duplicates; arbitrary descriptions cannot automatically identify duplicate bills. Do not enter the same electricity consumption both as an overhead bill and as equipment-based production energy.

Staffing includes total weekly paid hours, hourly rate and employer-cost allowance. Owner hours/rate are modelled separately. Channel assumptions cover Direct, Uber Eats and Deliveroo: percentage commission, gross/net commission basis, fee VAT and a fixed charge per sold unit. No real platform contract rate or tariff is prefilled.

Every successful autosave retains the complete business configuration as a new audited revision, including product prices and VAT assumptions. The costing date chooses the greatest effective date not later than that date; the newest revision wins when effective dates tie. Future effective dates schedule assumptions. Historical revisions remain in the database and the Settings history viewer. There is no new SQL migration: settings, immutable revision snapshots and pricing scenarios use new document kinds.

## Calculation conventions

All authoritative arithmetic uses C# decimal. Ordinary money is formatted to two decimal places only for display; allocation and costing retain precision internally. The existing recipe-costing engine and unit-conversion functions calculate supplier-based estimates. The catalogue refreshes published recipe quantities using supplier prices effective on the selected date, including recursively costed components. It separates nested ingredient, packaging and labour costs. It does not rewrite published recipe cost snapshots or inventory lots.

Equipment energy for a batch is `kW × minutes / 60 × load% × cost per kWh`; water is `litres / 1000 × cost per m³`. Divide by published yield for the per-unit figure. Standing charges use `daily charge × 365 / 12` per average month. Annual expenses use `annual amount / 12`; weekly hours use `52 / 12` weeks per month. These are documented average-month estimates, not calendar-day accruals.

The portion simulator scales ingredients, direct labour and energy linearly; packaging remains per sellable yield unit. Changing recipe lines or ingredients uses existing supplier quotes, not duplicate manually entered ingredient costs. This is a pricing forecast and does not create a revised production recipe. Equipment configuration should cover the whole batch, including subcomponents. Configured staff/owner labour replaces published labour for the whole estimate, including nested labour.

Customer channel prices include any configured output VAT. Net sales exclude output VAT only when VAT registered and the product is configured as taxable; zero-rated, exempt and outside-scope treatments remain distinct settings. Product tax classification is never inferred from its name.

For a purchase with net amount N, VAT amount V and configured recovery fraction R, estimated cost is `N + V × (1 − R)`. Product costs use the lower of the business and product recovery limits. Fixed overheads use the business recovery assumption. Fee VAT is applied to percentage commission plus the fixed fee; the unrecovered portion remains a cost. Partial/exempt recovery percentages must be configured explicitly. The app does not calculate a partial-exemption method or prepare a VAT return. See [HMRC: charging VAT](https://www.gov.uk/charge-reclaim-record-vat) and [reclaiming VAT on business expenses](https://www.gov.uk/charge-reclaim-record-vat/reclaim-vat-business-expenses) for the underlying distinction.

Per-unit contribution = net sales − ingredients − packaging − energy − paid labour − other variable costs − platform fees including unrecovered fee VAT. Contribution margin uses **net sales**, not the VAT-inclusive customer price.

### Fixed costs and allocation

The selectable allocation basis is:

| Method | Product/channel monthly weight |
| --- | --- |
| Units | Forecast units |
| Net revenue | Forecast units × net selling price |
| Labour | Forecast units × direct labour minutes per unit |

Allocated overhead per unit = fixed monthly pool × row weight / total weight / row forecast units. Allocated product operating profit = contribution − allocated overhead; profit margin divides that result by net sales. Zero-volume rows have no allocated per-unit profit. If the total basis is zero, all fixed costs stay visibly unallocated. Search filters product cards only; top-level results always describe the entire configured portfolio.

The payroll budget is a minimum monthly total. Paid labour already attributed directly to forecast products is deducted before adding remaining payroll overhead: `remaining payroll = max(0, budget − direct paid labour)`. Thus total paid labour is the greater of forecast direct labour and the payroll budget, rather than their sum. Published recipe paid labour counts toward this budget. An over-budget forecast is retained with a warning.

Owner labour is not paid-staff cost or part of product contribution. Total owner compensation is the greater of the configured owner-time budget and direct owner time across forecast products. The remaining owner allowance is allocated with the same method for the separately labelled after-owner result. It is never silently included a second time.

Break-even uses a constant forecast product/channel mix and excludes owner compensation and tax. It accounts for the payroll floor as volume changes. For contribution per unit C (after direct paid labour), direct paid labour per unit D, non-payroll fixed costs F and payroll budget S, required monthly units are `ceiling(max(F/C, (F+S)/(C+D)))`, provided the sales mix and positive contribution exist. Zero or negative contribution cannot fund fixed costs.

### Estimates versus recorded results

- **Estimated recipe costs** use published quantities and effective supplier prices with the selected business assumptions.
- **Actual batch costs** come directly from unreversed inventory production operations, including actual allocated lots, labour and entered other costs. The view shows up to 30 recent batches across locations/dates. Unknown costs stay unknown; estimated lot costs retain their status. New business assumptions do not revalue those historical amounts.
- **Contribution** is before allocated fixed costs and separate owner compensation.
- **Estimated operating profit** is forecast contribution less fixed costs; allocated product figures depend on volume/mix assumptions and are never labelled realised profit.
- **After owner compensation** is a separate planning result.
- **Actual recorded operating profit** is unavailable: the sales and expense ledger needed to establish it has not been implemented.
- **Profit after tax** is unsupported. No tax percentage is invented.

The visual breakdown reconciles customer price into output VAT, variable costs, overhead and estimated operating profit when allocation is available. Losses are displayed as negative profit; display rounding may produce penny-level differences between separately shown rows.

## Scenarios and planner integration

Temporary simulator edits do not save to recipes, supplier prices, live business settings, planner scenarios or inventory. Saving explicitly creates an immutable pricing-scenario snapshot; duplicate requests return the original result. A changed payload cannot overwrite a saved snapshot. Comparisons use frozen results even after newer supplier prices are entered. Loading saved assumptions recalculates against currently available effective source records; the original saved comparison stays frozen.

The existing financial planner uses orders/baskets; the new catalogue uses sellable product units. Import therefore explicitly assumes **one unit per order**, snapshots weighted revenue, variable costs, channel charges and remaining payroll overhead at the current volume, and creates a new named planner scenario. Existing planner scenarios retain their own assumptions and are not automatically combined with business expenses. Return to the catalogue to recalculate payroll allocation at a different forecast volume.

## Verification and preservation

- Git checkpoint: `2979fb7`, tag `business-settings-before`.
- Verified backup: `data/backups/before-business-20261013.db`.
- Original live data matches the baseline and backup row for row across **14 tables**: 34 documents, 37 supplier prices, 14 recipe versions, 135 audit records, 19 drafts, 9 inventory operations, 12 lots and 15 movements, plus all other rows. Integrity check: `ok`; foreign-key violations: none. No live business assumptions or test transactions were added.
- **122 backend tests passed**, preserving all previous 101 and adding 21 cases for tariffs, water, annual conversion, allocation, payroll, owner time, VAT, platform pricing, frozen scenarios, source-cost simulations, negative contribution, historical settings, concurrency, backup/restore, planner import and unknown actual costs.
- **22 browser tests passed**, preserving all previous 20 and adding desktop/mobile workflows. The new tests verify autosave, annual insurance, energy, channel prices, VAT simulation, ingredient/portion edits, immutable scenario comparison, unchanged live records, actual unknown batch costs, planner integration and glossary search. A final focused rerun also checks keyboard tooltip dismissal.
- TypeScript/Vite production build and .NET Release publish passed. Release output: `artifacts/business-profitability/`.
- Axe WCAG-tagged checks and horizontal viewport checks passed on desktop (1440px) and mobile (390px). Screenshots were visually reviewed. The regression suite exposed an inventory loading-state contrast issue; its loading state now uses a light panel, and dialog accessibility checks wait for the intended dialog.
- Local evidence: `artifacts/business-evidence/`. Tests use isolated databases. No server is left running by this work.

## Acceptance checklist

1. Start `Start Kitchen.cmd` and unlock your kitchen.
2. In Settings, enter your electricity/gas/water tariffs, standing charges and equipment ratings; confirm Saved, navigate away and return.
3. Enter annual insurance and confirm its monthly equivalent. Add rent/business rates, subscriptions and other costs as applicable. Mark a known directly attributed expense and check it is excluded from additional overhead.
4. Enter staff/owner assumptions and your own Uber Eats, Deliveroo and direct-sales fees. Choose a fixed-cost allocation method.
5. Configure VAT registration/recovery and each product's output treatment and recovery limit; do not accept zero placeholders as a verified tax classification.
6. In Money → Product profitability, search for a sellable recipe. Configure channel prices, monthly volumes, equipment minutes and labour basis.
7. Expand the cost breakdown. Check ingredient/packaging sources, energy, fees, contribution, overhead allocation and estimated profit. Compare the three channels.
8. Set volumes to zero in a simulation and confirm that per-unit allocation is unavailable; try units, revenue and labour allocation with meaningful volumes.
9. Temporarily change a selling price, ingredient, quantity, portion factor, commission or operating expense. Check recalculation and verify live settings, recipes and stock remain unchanged.
10. Save two pricing scenarios and compare their monthly results. Change live rates later and confirm the saved comparison does not rewrite itself.
11. Inspect actual recorded production costs separately; unknown stock costs must not turn into £0 or realised profit.
12. Create a new planner scenario from the business forecast. Verify the one-unit-per-order assumption and that your existing planner scenarios remain intact.
13. Schedule a future effective date, view a prior costing date and inspect retained revision history.
14. Search the glossary and focus a term tooltip with the keyboard; press Escape to dismiss it. Check desktop and mobile layouts.
15. Close the launcher window to stop local serving. Accept this improvement before starting Sprint 3.

## Practical limits

Rates, VAT treatments, energy profiles and sales volumes require owner input; zero defaults are explicitly unconfigured. Energy and portion scaling are estimates, not meter measurements or oven-capacity scheduling. Product channel fixed fees are per unit, not per multi-product basket. Actual batch results preserve the original inventory VAT/cost basis and do not become comparable realised profit merely because forecast VAT settings change.

Missing effective source prices or unavailable historical recipes are reported as exclusions and make the portfolio incomplete; correct those sources before relying on totals. A simulation with invalid edited recipe lines is rejected rather than silently dropping its selected product. Costing-date estimates use effective records known now, not a reconstruction of exactly what was known on that historical day; use saved result snapshots for frozen comparisons.

The Settings revision viewer shows retained business rates; historical product/channel assumptions can be viewed through a costing date and are also retained in full configuration snapshots. There is no recurring automatic import from suppliers or platforms, no orders/sales ledger, no tax filing and no Sprint 3 functionality. Browser validation uses Chromium desktop/mobile widths rather than physical devices. The Release package is compiled; the automated end-to-end server uses the Debug build of the same source.
