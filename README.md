# Dessert Kitchen Manager

A private Windows app for costing your first cheesecake pots and brownies and planning a UK dessert kitchen. **Sprint 1.1.1 is implemented and ready for owner acceptance.** All financial dashboard figures are planning estimates, not recorded sales or stock. See the [Sprint 1.1.1 hotfix handover and acceptance checklist](docs/SPRINT-1.1.1.md).

## Start

Requirements: .NET 8 runtime, .NET SDK 8 or 9, Node.js 22+ and npm. These were available on the development computer. Upgrade to .NET 10 LTS before network deployment; .NET 8 support ends 10 November 2026 ([Microsoft lifecycle](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core)).

Double-click **Start Kitchen.cmd**, or run from this folder:

```powershell
npm.cmd --prefix client ci
npm.cmd --prefix client run build
dotnet run --project server
```

Open **http://127.0.0.1:5080**. Create your owner password (12+ characters) on first launch. No default password is shipped. Leave the terminal running; Ctrl+C stops it. Data persists in `data/kitchen.db`, outside build outputs and excluded from Git. The eight illustrative products and one reusable biscuit base are seeded once.

## Enter your first batch

1. Open **Ingredients → Suppliers** and add your real supplier.
2. Add or edit your ingredient. For cream cheese, use `g` as the base unit.
3. Open **Prices & history**. Enter a 280 g pack at £3.25. Leave “Illustrative price” unticked for an actual quote; VAT recovery should be off when not registered.
4. Open **Recipes → Create a recipe**. Set batch yield, add 75 g cream cheese and your other ingredients, plus one pot/lid per portion.
5. Select **Calculate current costs**. The cream cheese line costs £0.87 after rounding. Set selling price and target margin. Edits save as a working draft; use **Publish / Finalise version** to create the immutable cost snapshot.
6. Use **Financial planner** for platform fees and fixed costs. The starting £21 basket, £5 variable cost, 30% commission and 20% unrecovered commission VAT give **£8.44 contribution/order** and **163 orders/month** to cover £1,375 fixed costs.

Owner hours (20/week), desired pay (£12/hour), orders (20/evening), investment (£5,000) and recovery period (24 months) are additional editable sample assumptions, not business facts.

## Available functionality

- Suppliers and ingredients: brand, reference, category, allergens, packaging and minimum-stock settings.
- Multiple supplier quotes with compatible units, VAT treatment, effective dates and illustrative/entered labels. Costs per g/ml/each and kg/l are calculated in C#.
- Recipe editor: packaging, waste allowance, sub-recipes, yield, portion sizes, preparation, storage, allergens and optional labour.
- Batch/portion costs, selling-price contribution and target-margin pricing. Recipe margins exclude platform fees and sales VAT; use the order planner for these.
- Immutable recipe versions and input cost history. Repricing is explicit: calculate/save a new version. Update saved sub-recipes before repricing their parents.
- Batch scaling from saved recipes, with quantities and active labour scaled proportionally. Review time assumptions before saving.
- Saved/duplicated/comparable financial scenarios, editable fixed expenses, opening schedule, owner pay, capital recovery and break-even targets.
- SQLite migrations, transactional saves, stale-edit conflicts, owner login and verified backup/restore.

The newest effective supplier quote is used, **not necessarily the cheapest supplier**. Future-dated quotes are excluded. Quotes are not purchases. Saved recipe versions retain their original prices. Unused suppliers and ingredients can be deleted with confirmation; referenced records can be archived and restored, with historical dependencies protected by database constraints.

Recipes now open in a read-only cooking view with visible numbered methods and Edit Method / Add Method. Existing ingredient, supplier and scenario forms autosave after 750 ms. Recipe, quote, new-ingredient and dietary-review forms retain working drafts; publication, finalisation and claim approval remain explicit. Check the save status before closing the browser. Failed/conflicting saves offer retry and an edits download.

Sprint 1.1 adds ordered preparation methods, explicit internal/sellable recipe types, separate variants, structured UK allergen information, documented dietary approvals and an internal printable/CSV allergen matrix. Unknown information never means confirmed suitable. Source changes invalidate affected approvals. The planner now groups assumptions, supports optional staffing and channel mixes, and compares server-calculated changes without overwriting scenarios.

Unexpected API errors are written to the console and `data/logs/errors-YYYY-MM-DD.log`. Passwords and request bodies are not logged.

## Backups and restore

Download a consistent SQLite backup from Settings. It includes the password hash and all history; keep it private. Stop the app before restoring:

```powershell
dotnet run --project server -- --restore "C:\Backups\dessert-kitchen-backup.db"
```

The command checks SQLite integrity/schema, preserves the old database as `kitchen.db.before-restore-TIMESTAMP`, and restores using SQLite's backup API. A process lock prevents restoring over a running app. Restoring also restores the owner password from that backup. Override storage using the `DatabasePath` environment variable if needed. Back up `data/` before upgrades.

## Development and verification

```powershell
dotnet test DessertKitchen.sln
npm.cmd --prefix client run build
# Optional dev frontend; run the API separately:
npm.cmd --prefix client run dev
```

Browser tests use a separate database on port 5081 and a test-only password, never your real database:

```powershell
Set-Location client
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Automated coverage: units, precision/rounding, VAT assumptions, wastage, labour, packaging, scaling, margins, commissions, break-even, negative contribution, price snapshots, stale edits, cyclic sub-recipes, authentication/origin checks, SQLite persistence/migrations and backup/restore. Browser tests cover account setup, supplier/ingredient/quote entry, recipe creation/scaling, scenario comparison, backup and mobile layout.

Manual checks: restart after saving a recipe; add a newer quote and verify historical versions remain unchanged; save a repriced version; restore a backup to a separate `DatabasePath` and compare records. Verify HTTPS/cookies in the actual IIS environment before network use. IIS deployment itself has not been tested.

## Architecture and scope

Read [the architecture and sprint plan](docs/ARCHITECTURE.md). React/TypeScript displays authoritative C# decimal results. Intermediate costing retains precision; output monetary boundaries use explicit rounding away from zero. Numbered SQL migrations run transactionally. Quotes and recipe versions preserve history.

For IIS: build the client, publish the server, install the matching ASP.NET Hosting Bundle, configure HTTPS and allowed hosts, grant the application pool access to a private absolute `DatabasePath`, and preserve Data Protection keys across deployments. Do not expose the database directory as static files. Default hosting binds to loopback only.

Known limits and scheduled work:

- **Sprint 2:** actual purchases, stock ledger, production, stocktakes, waste and alerts. Minimum-stock settings are stored but no stock balances are fabricated.
- **Sprint 3:** orders, sales, real-schema CSV imports/reconciliation and financial CSV/Excel reporting exports. Internal allergen CSV export is available now.
- **Sprint 4:** verified effective-dated tax modelling, P&L and cash flow. Current VAT fields are explicit assumptions, not product classifications, tax estimates or filing functionality.
- **Sprint 5:** authorised API adapters, multi-user roles and staff management. Staffing cost assumptions are available now; payroll is not. No private platform access or successful connections are simulated.
- No password recovery/change UI yet. Keep the owner password safe and retain backups.
- Child recipe labour/packaging is included in its sub-recipe line total. The top-level packaging/labour breakdown shows directly entered costs; the total includes both.
- Sample recipes, allergens and storage notes are illustrative. Verify actual recipes and supplier specifications before production.
