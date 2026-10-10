# Verification history

## Sprint 1.1.1 - 10 October 2026

63 backend tests and 11 browser workflows passed, with focused planner/navigation and allergen follow-up checks after final fixes. TypeScript/production build and Release publish passed. Real database preservation comparison retained 29 documents, 22 quotes, 11 recipe versions, 1 owner and 61 audit records; integrity and foreign-key checks passed. See [the hotfix report](SPRINT-1.1.1.md) for coverage, the illustration investigation, backup paths and acceptance checks.

## Sprint 1.1 - 10 October 2026

- `dotnet test DessertKitchen.sln --no-restore`: **54 passed**, none failed or skipped, including the original 40 regression tests.
- `npm.cmd --prefix client run build`: TypeScript and production build passed.
- `npm.cmd --prefix client run test:e2e`: **6 passed**. Following a print-only fix and Settings wording update, the build and affected allergen/print browser workflow passed again.
- `dotnet publish server --no-restore -c Release -o artifacts/publish`: passed. This verifies publishing output, not an IIS deployment.
- Populated schema-1 migration, automatic migration backup, schema-1 restore/migrate, schema-2 backup/restore, owner authentication, protected dependencies, archive/restore, immutable cost history and stale approval rejection are covered by integration tests.
- Real `data/kitchen.db` upgraded in place. A pre-upgrade baseline comparison confirmed every original record and JSON field preserved: 29 documents, 22 prices, 9 recipe versions, 1 owner and 56 audit records. SQLite integrity and foreign-key checks passed. No database reset or replacement was performed.
- Desktop/mobile planner screenshots inspected. Printed matrix rendered to PNG and inspected; the test dataset prints on one A3 landscape page without blank trailing pages.
- See [Sprint 1.1 acceptance checklist and limitations](SPRINT-1.1.md). Test datasets, screenshots and generated matrix PDFs are disposable files under ignored `client/test-results/`.

## Original Sprint 1 verification

Verified on the local Windows workspace on 10 October 2026.

## Automated checks

- `dotnet test DessertKitchen.sln --no-restore`: **40 passing tests**, no skipped tests.
- `npm.cmd --prefix client run build`: TypeScript check and production build pass.
- Playwright: **2 passing end-to-end tests**. The desktop test covers first-run password setup, creating supplier/ingredient/quote records, the 75 g cream cheese example, recipe saving/reloading/scaling, duplicating and saving a financial scenario, side-by-side comparison, backup download and logout. The mobile test covers navigation, layout overflow and recipe cost preview at 390 px width.
- NuGet audit: no known vulnerable packages reported for server and transitive dependencies by the configured sources. npm install audit: no vulnerabilities reported.
- SQLite backup is restored to a separate database in an integration test; password verification, recipe count and price history are checked after restore.
- Historical-price regression: adding a more expensive quote changes a preview/new version, while the prior saved version retains its original costs. Conflicting stale saves return HTTP 409 and create no extra version.
- Sub-recipe regression: intermediate costs below a penny retain precision when scaled to a large batch.

Screenshots produced under `client/test-results/` were visually inspected for desktop and mobile layouts. The directory is ignored because it includes disposable browser-test databases.

## Manual checks for the owner

1. Create your own password at http://127.0.0.1:5080. The browser tests use a different database and have not configured your owner account.
2. Add a real supplier quote and recipe; stop/restart the application and check the record persists.
3. Download a backup and keep it outside the working computer. Practise restore into a separate `DatabasePath` before relying on the process for operational records.
4. Verify supplier allergens, recipe quantities, storage, shelf life and the chosen VAT assumptions against your own records.

## Not claimed as tested or delivered

IIS/network deployment, live delivery-platform integrations, inventory, order imports, refunds, stock deductions, tax calculations and financial reconciliation are not Sprint 1 features. Their tests are scheduled with their implementation. The app has no HMRC filing connection. Tax-specific assumptions require verification in the accounting sprint.
