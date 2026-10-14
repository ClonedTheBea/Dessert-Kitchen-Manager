# Sprint 3 — Orders, Sales & Payments

Implemented in three tested stages and ready for owner acceptance. Sprint 4 has not started.

## Where to find it

The four main sections remain Home, Recipes, Stock and Money. **Home → New Order** opens the till. Money now contains Financial Overview, Orders, Sales, Import Sales and Payouts. Financial Overview and Price Breakdown retain their existing behaviour and calculation services.

Orders use a searchable dessert catalogue, channel-specific saved prices, quantities, removals, a separate discount and optional notes/reference. Save a draft or confirm the basket. Confirmed baskets are locked: cancel an unfulfilled order and create a replacement if its items need changing. Completed sales use linked refunds rather than rewritten prices. The list provides active/completed/cancelled/all filters, search, dates, totals, item summaries and separate fulfilment/payment states. Direct payment methods are Cash, Card, Bank transfer and Other/manual; no payment credentials are collected.

## Inventory and historical accuracy

- Completing an order consumes reviewed, usable finished lots by receipt order, matching its published recipe version. It records a sale-fulfilment stock operation and allocations, retaining the original batch and valuation. It does not consume baking ingredients again.
- Completion and its order update share one database transaction. Any shortage rolls the entire action back. Request IDs, stale-revision checks and channel/reference uniqueness prevent duplicate execution or sales. Repeating an identical successful request returns its earlier result.
- Made-to-order preparation is explicit: first record production through Stock, then select that production action on the order. It must match the recipe, version, quantity and location. Each action can be linked once; already consumed preparation cannot be reversed through the inventory reversal API. Existing production logic handles ingredient and held sub-recipe consumption.
- Cancellation never consumes stock. Refunds never return food. Use Stock's explicit waste or explained correction workflow for physical changes.
- The sale retains line prices, discounts, output VAT amounts or unknown status, channel fee assumptions, settings revision, expected fees and cost snapshots. Later settings changes do not reprice it. Expected platform fees include fee VAT for settlement purposes, separately from food-sales VAT.
- Import, refund, status, payment and payout events are auditable. Payout corrections retain the original record and replace it only in the active reconciliation view. A refund recorded after a payout makes the resulting difference visible again.

## CSV and payout scope

The CSV importer is general-purpose, **not certified against a current Deliveroo or Uber Eats export**. No representative platform files were supplied. It accepts comma-separated quoted CSV, up to 1 MB and 1,000 order rows, with a reusable saved column mapping. Use one row per order; consolidate multi-line item exports before import. Required mappings are platform reference, ISO order date/time and gross merchant sales. Optional mappings include product, quantity, merchant discount, commission including fee VAT, other fees, refunds, merchant adjustments, reported net and reported food-sales VAT.

Preview distinguishes new, duplicate, conflicting and incomplete rows. Confirmation imports only new rows; existing conflicting sales are not overwritten. Original source CSV and mapping are retained. A reported net amount is not proof of bank receipt. Missing quantity, VAT and costs remain unknown. Mapped products can provide historical recipe-cost estimates where a published version exists on that date.

Historical imports are financial-only and cannot consume today's stock. Separately verified historical fulfilment can link an existing matching made-to-order production action for every mapped product, with evidence and a matching UK production date. This links provenance and costs without another stock deduction. It does not retroactively infer prepared-stock movements.

Payouts are entered manually from a report and bank receipt; this sprint does not include a payout-file format adapter. Select completed orders from one channel, enter the bank receipt, and optionally supply reported commission and additional fees/refunds/merchant adjustments. Enter only extra fees/refunds not already recorded on those orders. Promotions, tips, delivery charges and withheld amounts must be explicitly assessed for merchant ownership; they are not automatically revenue.

Partial receipts reuse the complete settlement group and its report totals, using **Record another receipt for this group**. Groups can span periods, but overlapping subsets are rejected to avoid counting orders twice. Corrections retain the same matched group; arbitrary regrouping or automatic matching is not supported. A £170 receipt against £175 expected stays £5 unresolved; a subsequent £5 receipt reconciles it. Differences are never automatically posted as income or expenses.

An illustrative [general CSV fixture](SAMPLE-SALES.csv) contains the £300 sales − £108 commission/fee VAT − £7 other fees − £10 refund = £175 example. It is a file for isolated testing only and was not imported into the live workspace.

## Sales reporting and limits

Sales includes today/week/month totals, range totals and counts, average order value, daily bars, channel fees, bank receipts, awaiting payout and product statistics. It compares month-to-date actual orders/net sales with the full average-month forecast without changing assumptions. Sales use the original order date in UK time and include refunds recorded to date; cancelled and draft orders are excluded.

Recorded inventory costs and published-recipe estimates remain distinct. Product refunds and fees are allocated proportionally to discounted item values. Contribution is an estimate after known/estimated product costs and fee charges, before overheads, owner pay, tax and input-VAT recovery adjustments; recipe estimates may omit energy and other costs. Missing costs or output VAT leave contribution unknown. Order-level adjustments remain in payout reconciliation, not attributed to individual desserts. No actual operating-profit or after-tax-profit claim is made.

Current boundaries:

- Order entry uses whole quantities of sellable recipes yielding individual portions (`each`). Weighted sales and automatic portion conversions are not included.
- Active orders do not reserve stock. Availability is checked atomically at completion; another order cannot cause an unintended negative balance.
- Preparation links match an entire order line exactly; splitting one made-to-order action across orders is not supported.
- Direct payment recording is full paid/unpaid, with linked monetary refunds. No live payment processor, platform API or customer-address collection is included.
- Save a basket as a draft before leaving the Orders view; unsubmitted baskets are local component state.
- No sales CSV export was added, so imported text is rendered as text rather than executable spreadsheet output.

## Verification and preservation

- Accepted financial-polish state tagged `accepted-financial-polish-sprint3` before implementation.
- Verified SQLite backup: `data/backups/before-sprint3-20261014.db`; integrity returned `ok`.
- All **144 backend tests passed**, including the £19.85 basket, nine-to-seven stock, retry protection, cancellation, refund separation, 30% commission plus fee VAT, missing fees, CSV duplicates/conflicts, £175/£170 reconciliation, partial receipts, corrections, post-payout refunds, historical prices/commissions, stale edits, multi-line rollback, authentication and immutable audit.
- A populated copy of the real backup migrated from schema 4 to 5 with all pre-existing rows preserved and empty sales tables. Backup restoration with sales and stock records was tested.
- All **35 browser checks passed**. The six Sprint 3 desktop/mobile checks passed again after final payout and spacing refinements. They cover till entry/completion, imports, payouts, reporting, viewport fit and accessibility. Existing recipe, stock, settings, forecast and price-breakdown checks remain green.
- Production frontend build and Release publish succeeded. Output: `artifacts/sprint3-release`.
- Final comparison found **no changes in all 14 original live tables**. Live database and backup integrity checks returned `ok`. The live database remains schema 4 until the next launch, when additive migration 005 creates the five sales tables and the application's pre-migration backup. No sample orders, stock movements or payouts were added to live data.

## Screenshots

All screenshots use separate synthetic test databases:

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Till | [View](../artifacts/sprint3/till-1440.png) | [View](../artifacts/sprint3/till-390.png) |
| Completed order | [View](../artifacts/sprint3/order-1440.png) | [View](../artifacts/sprint3/order-390.png) |
| CSV preview | [View](../artifacts/sprint3/import-1440.png) | [View](../artifacts/sprint3/import-390.png) |
| Payout reconciliation | [View](../artifacts/sprint3/payout-1440.png) | [View](../artifacts/sprint3/payout-390.png) |
| Sales report | [View](../artifacts/sprint3/sales-1440.png) | [View](../artifacts/sprint3/sales-390.png) |

## Manual acceptance checklist

Use a separate test database for example sales. Launch with **Start Kitchen.cmd** as usual for the real workspace; its existing local-only lifecycle is unchanged.

1. From Home choose New Order. Select a channel, search desserts and add two brownies at £6.95 and one cheesecake at £5.95. Confirm £19.85 before discounts. Save/reopen a draft, then confirm it.
2. With nine reviewed finished brownies available in the matching published version, complete an order for two. Verify seven remain, one fulfilment operation, and no new ingredient consumption. Retry and confirm no duplicate deduction.
3. Cancel an unfulfilled order and check stock is unchanged. Refund a completed order and check the financial adjustment without returned food.
4. For a made-to-order line, record explicit production in Stock, then link the exact preparation action on the order. Check it cannot be used twice.
5. Record Cash/Card/Bank transfer payment on a direct order. Confirm payment and fulfilment remain separate.
6. Preview the sample CSV in an isolated database, map columns, save the mapping and confirm. Repeat: it should show a duplicate and move no stock. Change the existing reference's amount and verify it is a conflict, not an overwrite.
7. Match the sample order to a £170 payout: verify a £5 difference. Add the remaining £5 using the same group: verify reconciliation. Test an explained correction and inspect retained history.
8. Change today's saved price/commission; check the earlier order still shows its captured figures. Check Sales against Financial Overview without changing the forecast.
9. Repeat order creation and completion at mobile width. Inspect product search, basket, tabs and horizontally scrollable report tables.
10. Review Recipes, Stock, Settings, existing financial scenarios and backups. Close the launcher and confirm the local server stops.

Remaining work is owner acceptance and testing real representative platform files before any format-specific compatibility claim. Sprint 4 has not begun.
