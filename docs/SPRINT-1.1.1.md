# Sprint 1.1.1 hotfix handover

Implemented on 10 October 2026. Sprint 2 has not started. This release awaits owner acceptance.

## Recipe reading and methods

Recipe cards now open a read-only recipe view. Description, full numbered method, ingredients, yield, historical costing and storage are readable without opening editing controls. Edit Method / Add Method opens a focused editor with add, remove and reorder. Publish method & return creates one immutable version and returns to the readable view. Historical versions can be selected without changing the current recipe.

Edit recipe / resume draft opens the full editor. Leaving the editor retains the working draft; the normal reader displays the published version. Publish / Finalise is available at the top of the editor. No historical recipes, descriptions or cost snapshots were rewritten.

## Illustration investigation

The app uses category illustrations, not uploaded photographs. The existing implementation rendered internal recipe layer icons at 42 by 42 pixels and sellable recipe biscuit icons at 48 by 48 pixels. Mobile CSS set only width to 37 pixels, retaining the SVG's original 42/48-pixel height. These were confirmed inconsistent sizing and aspect-ratio rules. The version number itself is not used to size illustrations; a shrink caused solely by changing an otherwise identical recipe from version 1 to 2 was not reproduced. The user's existing versioned records retained their category/type, so the type-dependent size difference alone does not establish the entire reported sequence's cause.

Both illustration types now have a 48 by 48 desktop viewport and a 37 by 37 mobile viewport. Recipe cards use a column layout with a full-width, non-shrinking artwork region (137 pixels high on desktop; 110 on mobile). Long names, review warnings and version labels cannot squeeze that region. The reader has a stable 16:9 illustration/fallback container. Category/type still determine the illustration; no recipe association is keyed by version or array position.

The regression test creates versions 1, 2 and 3, including an internal/sellable conversion, and asserts identical card illustration and container dimensions at 1280 and 390 pixel viewports. It also switches historical versions in the reader and checks the container dimensions. If any size change remains in the user's specific reproduction, that sequence requires further investigation; the version-only cause is not claimed as proven.

## Automatic saving and versioning

Edits debounce for 750 ms. The status changes to Saved or Draft saved only after a successful server response. Requests are serialised per form; newer typing is retained while a request is in flight. Navigation, modal close, scenario switching and logout flush pending changes. A failed save blocks application navigation and shows the validation/server error, Retry save and Download edits. Reloading a draft after a failed initial load can also be retried.

| Form | Automatic save behaviour | Explicit action |
| --- | --- | --- |
| Recipes and methods | Persistent working draft | Publish / Finalise one immutable costed version |
| Existing ingredients and structured allergen information | Validated current record, optimistic revision check | Done closes the editor |
| New ingredient | Persistent draft, allowing unit/type changes before creation | Finalise ingredient |
| Suppliers | Validated current record | Save supplier remains as a shortcut |
| Supplier prices | Persistent working quote | Finalise supplier quote once into immutable price history |
| Financial scenarios and business expenses | Validated current scenario; duplicate creates a separate record | Save scenario remains as a shortcut |
| Dietary review notes, evidence and controls | Persistent review draft | Explicit review/approval action; approval is never automatic |

The Settings page currently has no editable business settings; business expense assumptions are in the planner and autosave there. Login, deletion, archive/restore, backup restoration and claim approval remain deliberate actions.

Drafts have their own revision and request identifier, independent of published recipe revisions. Retries of a successful draft request return its saved result. Publishing records its result in the same transaction as the recipe version/price/new ingredient, making a repeated publish request safe without duplicating history. Stale draft or record revisions return a conflict rather than overwriting newer changes. References in working recipes and price drafts also protect suppliers/ingredients from deletion.

## Revised allergen workflow

Ingredient rows distinguish Contains, May contain, Not declared as an ingredient (source reviewed), and Unknown / information not reviewed. Supplier/manufacturer name and source-verification notes complement the original declaration, source, date and reviewer. Missing information never becomes reviewed absence.

Recipe information explains when an allergen is not identified among declared ingredients while cross-contact suitability remains unverified. Recipes can be saved and published with pending dietary approval. Update ingredient supplier evidence opens the relevant ingredient directly, including nested sources. The separate review area lists missing source information, reviewer, preparation controls, evidence and applicable gluten evidence.

Review drafts never grant claims. Editing preparation controls or supporting evidence durably withdraws the relevant prior approval in the immutable review history, including if the user subsequently switches to another claim. Source/recipe changes continue to invalidate approvals through the dependency fingerprint. New approval remains explicit and server-validated. No automatic allergy-safe or coeliac-safe claims and no public ordering site were added.

## Migration and preservation

Migration **003_working_drafts.sql** adds the working_drafts table. Existing document, price, recipe-version and approval records are unchanged by the migration. Backup/restore accepts schemas 1, 2 and 3 and retains drafts and publication receipts. The populated database is backed up automatically before migration.

The user's database was upgraded in place. A baseline comparison confirmed that all original records and JSON fields were retained: **29 documents, 22 prices, 11 recipe versions, 1 owner and 61 audit records**. SQLite integrity and foreign-key checks passed. The owner account remains configured. No reset or replacement was performed.

Pre-hotfix backups retained:

- `data/backups/before-sprint111-20261010-101054.db`
- `data/backups/before-migration-3-20261010-093030511.db` (UTC timestamp)

Earlier backups remain in place.

## Verification

- **63 backend tests passed**, including all 54 prior tests and nine hotfix tests covering draft persistence, validation, conflicts, idempotent save/publication, new ingredient unit choice, price history, backup/restore, dependency protection and durable approval withdrawal.
- **11 browser workflows passed**: all six prior workflows adapted for read-only opening, plus five hotfix workflows covering methods/drafts/publication, outages/retries/rapid edits, navigation/validation/conflicts, illustration versions 1-3 on desktop/mobile and draft-load recovery.
- After the final planner status/duplicate adjustment, both affected planner/navigation browser workflows passed again. The final approval-withdrawal change was checked with the backend suite and the allergen browser workflow.
- TypeScript and production frontend build passed. Release publish passed. Desktop/mobile reader screenshots were inspected.
- Real database baseline, integrity and foreign-key checks passed. IIS/network deployment was not tested.

## Manual acceptance checklist

Use your existing owner login at http://127.0.0.1:5080. Download a backup before modifying operational records; use disposable copies/test records for approval and failure simulations.

- [ ] Open an existing recipe: read its description, full numbered method, ingredients and storage without entering edit mode. Confirm the empty-method prompt on a recipe without steps.
- [ ] Select Edit Method / Add Method. Type, reorder and remove steps; wait for Draft saved. Return without publishing and reopen to confirm recovery. Publish once and confirm one new version, the readable method and unchanged older history.
- [ ] Check biscuit and layer illustrations through versions 1, 2 and 3 on desktop and mobile, including long names and source-review warnings. Check historical version switching.
- [ ] Edit an ingredient, supplier and scenario; wait for Saved, close/navigate and reopen. Confirm the edits persisted and another scenario was not overwritten. Duplicate a scenario without typing and confirm it is saved separately.
- [ ] Begin a new ingredient; allow the draft to save, then choose a different unit before finalising. Begin a quote; confirm draft autosaves do not add price-history entries and finalising adds only one.
- [ ] Disconnect/reconnect the test server or simulate a failed request. Confirm Unable to save, retained edits, blocked navigation, Retry save and Download edits. In two windows, attempt conflicting saves and confirm the newer record is protected.
- [ ] Review ingredient source evidence with contains, may-contain, reviewed undeclared and unknown cases. Confirm celery being undeclared does not block normal recipe publication. Use the direct ingredient-evidence action from a nested recipe.
- [ ] Record only claims supported by actual evidence and controls. On disposable test data, confirm missing evidence rejects approval. Change controls after approval, then switch claim target: the old approval must stay withdrawn until explicit re-approval.
- [ ] Download a schema-3 backup and practise restoration to a separate DatabasePath with the app stopped. Confirm drafts, history, quotes, scenarios, owner login and reviews are present.

## Known limitations

- No full offline mode or automatic conflict merging. Failed mutable-record edits remain in memory, with an export option; unsaved browser close/reload prompts protect them where supported. A forced browser/process shutdown before the server acknowledges a save can still lose those latest edits. Download conflicting edits before reopening and manually merging the current record.
- One shared working draft per recipe, one new-recipe draft, one new-ingredient draft, one quote draft per ingredient and one review form draft per recipe. Concurrent windows use revision conflicts. Drafts are private and included in backups; they do not feed published costs/claims.
- Supplier-source review is a recorded human assessment, not independent testing. Evidence remains text/references, not uploaded laboratory documents. Existing conservative cross-contact and gluten-free approval safeguards remain.
- The illustration rules and regression are corrected, but a change triggered by version number alone was not reproduced. This distinction should be checked during acceptance rather than represented as a confirmed version-data defect.

Do not begin Sprint 2 until Sprint 1.1.1 is accepted.
