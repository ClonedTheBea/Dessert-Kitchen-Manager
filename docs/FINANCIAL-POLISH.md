# Financial UX polish

Ready for owner acceptance. Sprint 3 has not started.

## Changes

- Money's monthly running-cost chart now has **Edit running costs**, including when no bills have been entered. The dialog lists fixed bills with name, amount and monthly/yearly period, plus **+ Add running cost**. Standing charges and staffing are available in a secondary section. Save commits a business revision and refreshes the chart and totals; Cancel, Escape or close discards unsaved edits. Failed validation retains the draft. Full Business Settings remain available.
- The quick editor reads the latest configuration, preserves its effective date, VAT settings, attribution, products and channel rates, and uses the existing revision-conflict checks. Future-effective settings show a warning: they do not change today's overview until their effective date. Directly attributed and per-unit expenses stay in full Business Settings rather than becoming duplicated fixed bills.
- Financial Overview summary cards now scroll as normal page content.
- Both price-breakdown views sort configured nonzero commissions highest first, breaking ties alphabetically. Zero/unconfigured options come last. Deliveroo 30%, Uber Eats 30%, Direct 0% therefore opens on Deliveroo. No-nonzero-rate configurations show an explanatory message; explicitly confirmed zero fees remain valid, while missing fees remain incomplete.
- Chart colours use central semantic tokens: amber ingredients, blue packaging, ochre energy, teal labour/other direct costs, coral fees, purple VAT and green contribution. The chart and legend share the same mapping; names, amounts and percentages remain available without relying on colour. The existing combined labour/other-direct-cost segment and exact rounding are retained.
- Product Pricing now has a searchable button list aligned with Money's dessert chooser, a visible selected state and a 24px gap between its panes. Existing save flushing and revision refresh remain in place when switching products or modes. Temporary tests, saved prices and advanced scenarios remain separate.

No backend calculation changes, database migrations or theme redesign were made.

## Verification

- All 133 backend tests passed. An initial concurrent build encountered the browser server's executable lock; the clean rerun after that server exited passed.
- All 29 Playwright checks passed, including desktop/mobile Save, Cancel, immediate chart updates, annual cost conversion, channel ordering, chart/legend colour matching, product selection and accessibility checks.
- The three focused polish checks passed again after final layout adjustments, with an added failed-save test confirming invalid amounts retain the draft and do not modify saved settings.
- Production frontend build and Release publish succeeded (`artifacts/financial-polish-release`).
- All 14 live database tables matched the pre-change row snapshot. Live and backup integrity checks returned `ok`. Backup: `data/backups/before-financial-polish-20261014.db`. Browser tests used disposable databases; no acceptance expenses were written to the live workspace.

## Screenshots

These use synthetic test data. Local artifacts:

- [Money desktop](../artifacts/financial-polish/money-1440.png) / [mobile](../artifacts/financial-polish/money-390.png)
- [Running-cost editor desktop](../artifacts/financial-polish/editor-1440.png) / [mobile](../artifacts/financial-polish/editor-390.png)
- [Price Breakdown desktop](../artifacts/financial-polish/chart-1440.png) / [mobile](../artifacts/financial-polish/chart-390.png)
- [Product Pricing desktop](../artifacts/financial-polish/pricing-1440.png) / [mobile](../artifacts/financial-polish/pricing-390.png)

## Manual acceptance checklist

1. Launch **Start Kitchen.cmd**, open Money and scroll: the four summary cards should move with the page.
2. Click **Edit running costs**, change a bill and cancel. Reopen and confirm the saved amount is unchanged.
3. Change Rent from £650 to £700 and save. Confirm the cost bar and total update immediately. Use a disposable workspace or restore your intended amount afterward.
4. Add Insurance at £540/year and save. Confirm it contributes £45/month. If settings are future-effective, confirm the warning and verify the future record rather than expecting today's totals to change.
5. With Deliveroo and Uber Eats configured at 30%, Direct at 0%, open a product's Price Breakdown: Deliveroo should be selected, followed by Uber Eats then Direct in the dropdown.
6. Compare chart segments with their legend colours and values. Check a product with incomplete costs still shows the missing-cost guidance.
7. In Settings → Product pricing, search for a dessert and click it. Check the selected state, pane gap and immediate pricing update; edit a saved price or choose a temporary test as needed.
8. Repeat on a narrow/mobile layout. Verify existing recipes, stock and business history remain available.
