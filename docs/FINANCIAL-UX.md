# Financial UX Redesign — handover

Implemented 13 October 2026. Ready for owner acceptance; Sprint 3 has not started.

## Using the application

Run **Start Kitchen.cmd** as usual. Keep its window open while using the site; closing it stops the local server.

The four main sections remain Home, Recipes, Stock and Money. The Apiary plum shell, light cards and central design tokens are retained.

- **Settings → Business Settings:** regular costs, utilities/equipment, staff/owner time, selling platforms, opening hours and forecast assumptions. Ordinary changes autosave with effective-date history. Expense attribution and utility VAT details are tucked behind Advanced controls.
- **Settings → Product pricing:** permanent prices, product sales volumes, energy usage, product VAT treatment and direct labour. Choose a product, then **Advanced pricing scenarios** for the existing temporary ingredient/portion/rate simulator and saved comparisons.
- **Money → Financial Overview:** read-only summary cards, monthly cost/revenue/result charts, break-even per trading evening and “How many orders?”. Missing required assumptions show setup guidance instead of zero profit.
- **Money → Search desserts → Price Breakdown:** opens directly as a desktop side panel or full-screen mobile sheet. Direct, Deliveroo and Uber Eats switching only changes the view. **Try a Different Price** is temporary; permanent changes link to Settings.
- **Money → Financial glossary:** the existing searchable definitions. Contribution now consistently means “Money remaining after direct selling costs, before monthly business expenses.”

## One active configuration and preserved scenarios

Business settings are the active source for overheads, tariffs, staffing, owner allowances, VAT registration/recovery, platform contracts and order forecasting. The old editable Money planner and separate profitability navigation are no longer routed.

Existing saved planner scenarios have not been rewritten or deleted. They are readable under **Saved financial scenarios**; **Use sales assumptions** copies only their sales/target/opening assumptions into the active configuration, pending review. Historical expense, staff and channel fields in that copied template are ignored when calculating the current overview; business settings supply those values.

**Advanced: compare forecasts & actual production costs → Prepare current forecast** takes a snapshot of the currently effective, saved configuration. It can be compared with historical scenarios or saved under a new name using the existing scenario service. These are reference snapshots, not competing live configuration. The current overview adjusts break-even for the payroll floor; legacy scenario comparisons retain their historical fixed-volume model. Saved pricing scenarios retain their immutable inputs/results and existing comparison workflow.

Future effective dates remain scheduled. Money uses the settings effective today, which may differ from the most recently edited future revision. Preparing a forecast snapshot also uses today. Business revision history remains available in Settings.

## Calculation and chart details

The existing recipe costing, effective supplier pricing, profitability/VAT and order-model services are reused. Two thin read/preview endpoints compose the overview and supply reconciled chart segments. There is no database migration: only optional JSON fields for the active forecast and explicit configuration flags, plus planned trading weeks (default 52 for old scenarios).

- **Order forecast:** average order value and average direct cost are reviewed whole-basket assumptions. The direct-cost amount includes ingredient, packaging, production energy and paid labour after recoverable input VAT. Platform fees and additional configured per-unit business expenses are added automatically. Average products per order converts per-product fees/expenses; it does not treat every product as an order.
- **Product calculation:** recipe/supplier costs remain the source of truth; no duplicate ingredient price entry. Configured product volumes feed per-product overhead allocation, independently of the whole-order forecast. Changing them does not silently replace the reviewed average basket/direct-cost assumptions.
- **Annual expenses:** divide by 12; daily standing charges use 365/12. Trading evenings use open days × planned trading weeks / 12. Staffing and owner weekly budgets still use 52/12, including non-trading weeks.
- **No double payroll:** paid labour identified within direct order costs reduces the remaining staff overhead budget. Break-even recomputes this floor at the required volume. Other expenses marked already attributed directly are excluded. Descriptions alone cannot detect duplicate electricity bills; do not enter the same usage as both overhead and equipment consumption.
- **Doughnut:** ingredients + packaging + energy + other direct costs + platform fees including unrecovered fee VAT + output VAT + remaining contribution = customer selling price. Fixed overheads are excluded. Optional estimated overhead allocation and operating profit appear separately and depend on saved volumes and allocation method.
- **Rounding:** financial calculations retain decimal precision. For display, floor each segment to pennies and distribute remaining pennies to the largest fractional remainders. Apply the same method to hundredths of a percentage point. The visible legend therefore totals the rounded selling price and exactly 100.00%. The prominent contribution uses the chart's displayed contribution amount. Zero-value segments are omitted.
- **Example verified:** £5.95 = £1.41 ingredients + £0.16 packaging + £2.14 fees + £2.24 contribution. Percentages: 23.70%, 2.69%, 35.96%, 37.65%.
- **Unknown costs:** missing commission differs from a confirmed zero. Product VAT and energy must be reviewed; energy usage requires known tariffs. Incomplete breakdowns suppress the doughnut/full contribution and label unknown costs. Negative contribution is explained without drawing a negative slice. Zero/sub-penny selling prices have no percentage chart. Illustrative supplier inputs remain labelled estimates/unverified.
- **Actual results:** recorded batch costs remain available in advanced Settings comparisons. They are not realised product profit. Actual operating profit and profit after tax remain explicitly unavailable.

## Verification and preservation

- Backend: **130 passed**, including the existing 122 tests and 8 new financial UX cases (parameterised VAT cases included).
- Browser: **24 passed**, including the existing 22 updated for the new navigation and 2 new end-to-end acceptance cases at 1440px and 390px. Final focused financial checks were rerun after UI polish.
- Coverage includes rent/annual insurance/22p tariff persistence, payroll-floor break-even, exact penny/percentage reconciliation, VAT recovery, incomplete/negative/zero prices, channel comparison, temporary price focus, saved scenarios, autosave, stock/recipe regression and mobile/desktop accessibility audits.
- Production TypeScript/Vite build and .NET Release publish passed. Published application smoke-tested with a separate temporary database: static UI, owner setup, authenticated overview and incomplete-data guard. Test server stopped afterward.
- Verified pre-change backup: `data/backups/before-financial-ux-20261013-170254.db`. Git checkpoint: `financial-ux-before` (`575e5bb`).
- Live database and backup integrity checks: **OK**. Every row matches the pre-change baseline: 49 documents, 37 prices, 14 recipe versions, 149 audit rows, 19 working drafts, 9 inventory operations, 12 lots and 15 movements. Business revision 14 and existing history remain intact. Schema remains version 4. Owner/authentication data also preserved; no private data is included in screenshots.
- All browser fixtures and Release smoke data are isolated from `data/kitchen.db`.

## Screenshots

These are **synthetic test fixtures**, not the owner's business numbers. Before images were captured from the unchanged pre-redesign implementation and copied before editing; after images are from the acceptance tests. They show layout changes, not a before/after financial comparison. Files are local ignored artifacts so private/future screenshots are not committed accidentally.

| View | Before | After |
|---|---|---|
| Money — desktop | [Before](../artifacts/financial-ux-evidence/before/redesign-money-1440.png) | [After](../artifacts/financial-ux-evidence/after/money-1440.png) |
| Money — mobile | [Before](../artifacts/financial-ux-evidence/before/redesign-money-390.png) | [After](../artifacts/financial-ux-evidence/after/money-390.png) |
| Business Settings — desktop | [Before](../artifacts/financial-ux-evidence/before/business-settings-1440.png) | [After](../artifacts/financial-ux-evidence/after/settings-1440.png) |
| Business Settings — mobile | [Before](../artifacts/financial-ux-evidence/before/business-settings-390.png) | [After](../artifacts/financial-ux-evidence/after/settings-390.png) |
| Price Breakdown & doughnut | New view | [Desktop](../artifacts/financial-ux-evidence/after/price-breakdown-1440.png) · [Mobile](../artifacts/financial-ux-evidence/after/price-breakdown-390.png) |

## Owner acceptance checklist

Use a test copy if you want to reproduce the illustrative numbers without changing your real assumptions.

- [ ] Open Settings → Business Settings. Enter rent £625/month and insurance £540/year; confirm £45/month.
- [ ] Set electricity to **22** in the **p/kWh** field, not 0.22. Configure equipment where needed.
- [ ] Review staff/owner hours, selling-platform rates (confirm zero explicitly where appropriate), days/times open and trading weeks.
- [ ] Review forecast order value, direct cost, products per basket, expected orders and channel shares totalling 100%. Tick the reviewed checkbox. Wait for Saved, refresh and check persistence.
- [ ] Open Money. Confirm four clearly labelled cards, charts and orders/evening. There should be no ordinary business configuration form.
- [ ] Search a cheesecake and open Price Breakdown. Check channel, ingredients, packaging, fees, output VAT if applicable, and contribution explanation.
- [ ] Review any missing product VAT/energy/commission through the Settings links. A missing essential cost must not show a complete chart or contribution.
- [ ] Switch Direct/Deliveroo/Uber Eats and try an alternative price. Close/reopen the panel and confirm the saved price is unchanged.
- [ ] In Settings → Product pricing, check saved prices and advanced pricing scenarios; compare a saved scenario. Check effective-date history and historical planner scenarios.
- [ ] Check the panel on a narrow/mobile screen; tab through controls and close with Escape. Inspect the text legend as well as the chart.
- [ ] Confirm the interface and accounting assumptions are accepted before authorising Sprint 3.
