# First-use experience & usability repair

Ready for owner acceptance. Sprint 3 has not started. The Apiary theme, calculation services, stock ledger and historical records are retained.

## What changed

Home now offers **Cost a dessert**, **Plan my business** and **Manage stock**, using existing records. Its optional checklist can be hidden and reopened; dismissal persists in that browser. Home and Money now use the same active business configuration.

Cost a dessert opens a simple product, temporary price and channel workflow. Ingredient and packaging costs appear before business setup is complete. Missing costs have direct setup links. The uncosted remainder is explicitly not contribution or profit; the reconciled doughnut appears only when applicable costs are complete. Saved prices and advanced scenarios remain separate.

Known monthly expenses, annual expenses converted to monthly amounts, standing charges and configured staffing budgets are available without a sales forecast. Missing forecast requirements explain what to enter and link to the relevant settings. With a complete forecast, existing direct-labour offsets prevent counting payroll twice.

Ordinary bills remain prominent in Business Settings. Configuration history, scheduling, VAT and other advanced assumptions are secondary. Future-effective configurations still show a visible warning explaining when they will affect results.

## Save failure

The global input VAT recovery control previously allowed a nonregistered business to enter a nonzero percentage. The server correctly rejected that configuration; subsequent ordinary expense edits were then blocked by the same invalid field. The separate product recovery default of 100% was a dormant cap rather than the cause of global validation, but was also inappropriate for a new nonregistered product.

Global recovery is now disabled when unregistered, and new product recovery defaults follow registration and the configured recovery limit. Historical product caps are retained and ignored while unregistered. Validation remains in place. If an invalid draft is loaded, a visible field-specific message and **Use no VAT recovery (0%)** action let the user deliberately repair it while retaining their other edits. The regression reproduces the exact server error and verifies that the already-entered rent saves after this explicit correction.

## Verification

- 133 backend tests passed, including VAT defaults, exact validation failure and repair, historical preservation, annual expense conversion and partial recipe costs.
- All 26 browser tests passed at desktop and mobile sizes. The six affected business, financial overview and first-use tests were rerun successfully after final layout refinements. Checks include accessibility, horizontal overflow, autosave, price-test isolation and onboarding dismissal.
- Additional browser acceptance tests passed against a genuinely empty database (example seeding disabled) and a separate copy of the populated working database. The populated test preserved recipes, inventory, existing expenses, products and historical revisions while saving a new test bill. Only the copy's owner credentials were reset for test login.
- Production frontend build and Release publish passed.
- All 14 live database tables matched the pre-change row snapshot. Live database and backup integrity checks returned `ok`. Backup: `data/backups/before-first-use-20261013-202258.db`. No schema migration was needed.

Local visual evidence: [Home desktop](../artifacts/first-use-evidence/home-1440.png), [Home mobile](../artifacts/first-use-evidence/home-390.png), [partial price desktop](../artifacts/first-use-evidence/partial-price-1440.png), [partial price mobile](../artifacts/first-use-evidence/partial-price-390.png), [partial Money mobile](../artifacts/first-use-evidence/partial-money-390.png). These images use synthetic test data.

## Brief manual acceptance checklist

1. Start the app with **Start Kitchen.cmd**. Without an explanation, spend ten seconds on Home and choose where you would begin. The ten-second comprehension criterion needs a real new user's judgement; automated visibility checks cannot establish it.
2. Choose **Cost a dessert**, select an existing brownie and check that its known ingredient and packaging costs appear immediately.
3. Enter a temporary selling price; switch Direct and Deliveroo. Check known fees or the explicit missing-fee message. Verify that the saved price remains unchanged.
4. Follow a missing energy or VAT setup link. Confirm that advanced controls are secondary and the earlier known costs remain useful.
5. In **Plan my business**, enter rent of £625/month or insurance of £20/month. Wait for **Saved**, then open Money and confirm the monthly expense appears without a sales forecast. Use a test database, or restore your intended expense afterward.
6. For a nonregistered business, confirm that VAT recovery cannot be edited. Any loaded incompatible draft should show the explicit correction beside the error, retaining ordinary expense edits.
7. Hide getting started, reload Home and reopen it using **Show getting started**. Check both desktop and mobile layouts.
8. Check existing recipes, stock, expenses and history, then close the launcher window and confirm the local site stops serving.

For repeatable isolated workspace checks, set `KITCHEN_ACCEPTANCE` to `empty` or `populated`, `KITCHEN_TEST_SEED=false`, and `KITCHEN_TEST_DATABASE` to the appropriate disposable database before running `npx.cmd playwright test e2e/firstUseWorkspace.spec.ts` from `client`. Never point acceptance tests at the live database. Normal application example seeding remains unchanged.
