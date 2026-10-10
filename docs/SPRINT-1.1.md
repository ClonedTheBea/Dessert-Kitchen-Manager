# Sprint 1.1 handover

Implemented on 10 October 2026. Ready for owner acceptance; Sprint 2 has not begun.

## Changes

- Recipes have a separate description and persistent numbered preparation steps with add, remove, reorder and readable version history. Existing combined prose remains unchanged in Description for manual separation. Internal recipes hide sales pricing while retaining values for later conversion to sellable products. Variants are independently costed and versioned.
- Ingredients record all 14 UK allergens, contains/may-contain information, original supplier text, verification source/date/reviewer and cross-contact notes. Nested recipes, toppings, optional additions and packaging components contribute to assessments. Substitutions recalculate current costs/allergens and prompt quantity and suitability review. Source changes flag parents and withdraw stale approvals.
- Recipe filters distinguish contains/risk, unknown/unverified and explicitly verified suitability. Documented dietary reviews require supplier verification, preparation controls, reviewer/date and evidence references. Gluten-free approval also requires a documented food-as-sold gluten level of 0-20 ppm. No coeliac-safe label is generated. The internal matrix supports browser print and CSV export.
- The financial planner groups assumptions into expandable sections, retains existing decimal calculations and saved scenarios, adds opt-in sales-channel mixes and paid staffing allowances, and displays revenue/contribution/profit/break-even separately. Comparisons show changes without saving either scenario.
- Ingredients and suppliers have confirmed delete for unused records, archive/restore for retained records, archived filters and dependency explanations. Foreign keys and transactional operations protect price and recipe history. Form labels, keyboard access, spacing and mobile behaviour were improved.

## Migration and preservation

`server/Migrations/002_recipe_safety_and_record_management.sql` is additive. It adds default method/type/archive/allergen fields, dependency tables/triggers and dietary reviews. Original combined descriptions and allergen prose remain intact. Existing records in the Sub-recipes category default to internal; other records default to sellable and can be changed manually. Old allergen prose is deliberately not inferred as a verified declaration. Old versions gain safe defaults without changing their original costs.

The actual populated database was upgraded in place and compared with the pre-upgrade baseline. All original fields and records were retained: **29 documents, 22 prices, 9 recipe versions, 1 owner and 56 audit records**. The documents include suppliers, ingredients, recipes, saved scenarios and expenses. Integrity and foreign-key checks passed. The existing owner account remains configured.

Backups retained under `data/backups/`:

- `before-sprint11-20261010-082332.db`: consistent SQLite backup taken before implementation.
- `before-migration-2-20261010-074837591.db`: automatic backup immediately before migration 002 (timestamp in UTC).

Existing backups were not deleted. Settings backup includes the new reviews and archive state. Restore supports schema 1 and 2; a restored schema-1 backup migrates on next startup. Stop the application before restore and use the README command. Restore also restores the password from that backup. Test restores use separate disposable databases.

## Verification

- 54 backend tests passed, including all 40 original regression tests.
- 6 browser workflows passed: original costing/scaling/scenarios/backup/mobile flows plus methods/variants, protected record management, documented allergen approvals/invalidation/export/print and planner staffing/channel/mobile flows.
- TypeScript and production frontend build passed; Release publish passed.
- A subsequent print-style correction was rebuilt and the affected browser workflow passed again. Rendered PDF verified as one A3 landscape page for its test dataset.
- Populated migration and backup/restore tests cover legacy prose, method ordering/history, nested sources, unknown information, claim approval safeguards, substitutions, supplier-source changes, deletion constraints, archive/restore, historical costs and optional financial assumptions.
- Real database baseline comparison, SQLite integrity and foreign-key checks passed. Original scenario calculations remain covered by the regression suite.

## Known limits

- This is an internal record/review system. Owner approval and evidence references are recorded; the app cannot independently validate supplier statements, laboratory results, cleaning procedures or medical suitability. Evidence is stored as text/references, not uploaded files. No public menu, ordering site or customer label generator was added.
- Approval is conservative: declared contains/may-contain information, unresolved cross-contact notes, or unknown/unverified sources prevent approval. Cross-contact notes currently block all allergen approvals until resolved. Specialist products requiring a more nuanced assessment are not automatically approved.
- All declared optional components are included in both costing and allergen assessment. Create a separate variant for an omission or substitution. Check quantities, texture and preparation controls yourself.
- Changed supplier/product references require ingredient re-verification. Allergen profiles must also be updated manually when a supplier announces a formulation change. Current safety assessments use the latest child recipe, while old cost snapshots retain their original inputs. Legacy versions do not invent historical verified assessments.
- The cash break-even figure is a planning proxy excluding VAT payment timing, tax and working capital. Employer costs are an allowance, not payroll/NI calculations. Channel shares assume the same average order value across channels. No tax module or inventory module was added.
- Browser comparison tables and the allergen matrix scroll within their panels on narrow screens. The printed matrix is designed for A3 landscape; choose an appropriate print scale for smaller paper.
- Local Windows operation was tested. IIS/network deployment remains untested. Existing password recovery/change UI limitations remain.

The allergen design uses the [UK technical guidance](https://www.gov.uk/government/publications/food-allergen-labelling-and-information-requirements-technical-guidance/food-allergen-labelling-and-information-requirements-technical-guidance) and [takeaway allergen guidance](https://www.gov.uk/food-allergies). The matrix reminds staff that distance-sale allergen information must be provided before purchase and on delivery; this internal reference does not itself fulfil customer communication.

## Manual acceptance checklist

Use your existing login at http://127.0.0.1:5080. Back up from Settings before changing production records; use clearly named temporary records or a separate database for destructive acceptance tests.

- [ ] Check existing recipes, suppliers, ingredients, quote history, saved scenarios and old recipe costs against your records. Existing combined description/method text should still be present.
- [ ] Add three preparation steps, enter a long instruction, reorder/remove a step, save, reopen and inspect version history. Repeat at mobile width and with keyboard navigation.
- [ ] Change an internal recipe to sellable and back; confirm unit choices and stored selling-price data survive, and internal views prioritise cost per yield unit.
- [ ] Record actual contains/may-contain declarations and supplier evidence on test ingredients. Confirm unknown entries are never shown as verified suitable.
- [ ] Build a nested test recipe with an optional/topping component. Confirm combined allergens and source warnings. Change the child or supplier reference and confirm the parent requires re-evaluation.
- [ ] Create a separately costed variant and substitute an ingredient. Confirm recalculated costs/allergens, quantity warning, distinct history and withdrawal of old approvals.
- [ ] On test data, attempt a dietary approval with missing evidence/controls or gluten above 20 ppm and confirm rejection. Record a complete review only when you have verified its actual evidence and controls. Check restriction filters distinguish verified, review-needed and unsuitable records.
- [ ] Open the matrix, export CSV and print/save PDF. Check all recipes, internal components and variants appear, with readable allergen statuses and date.
- [ ] Create an unused supplier/ingredient and delete it with confirmation. Try a referenced record: inspect the dependency reason, archive it, enable the archived filter and restore it. Check quote/version history remains intact.
- [ ] Duplicate a financial scenario; compare rent, order volume, staffing, commissions and VAT assumptions. Verify the original scenario remains unchanged and baseline contribution is still £8.44 for its original assumptions. Check desktop and mobile results.
- [ ] Download a post-upgrade backup. Practise restore to a separate DatabasePath with the app stopped; check owner login, method order, review history, archived state, prices and scenarios. Restart the normal application afterward.

Record acceptance or any requested corrections before starting Sprint 2.
